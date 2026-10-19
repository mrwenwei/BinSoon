"""Read-only by default; --write-demo explicitly exercises an isolated demo API."""
import argparse
import io
import os
from uuid import uuid4
import httpx
from PIL import Image
from dotenv import dotenv_values


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url')
    parser.add_argument('--write-demo',action='store_true')
    args=parser.parse_args()
    values=dict(dotenv_values('.env')); values.update(os.environ)
    with httpx.Client(base_url=args.url.rstrip('/'),timeout=30) as client:
        def call(method,path,token=None,body=None,etag=None,**kwargs):
            headers={'Idempotency-Key':str(uuid4())}
            if token: headers['Authorization']='Bearer '+token
            if etag: headers['If-Match']=etag
            response=client.request(method,path,json=body,headers=headers,**kwargs)
            if response.is_error:
                # Never print request passwords, tokens, photo content, or URLs with tickets.
                try: detail=response.json().get('detail',{})
                except ValueError: detail={}
                code=detail.get('code','HTTP_ERROR') if isinstance(detail,dict) else 'HTTP_ERROR'
                raise RuntimeError(f'{method} {path}: {response.status_code} {code}')
            return response
        assert call('GET','/health').json()['status']=='ok'
        assert '/api/v1/reports' in call('GET','/openapi.json').json()['paths']
        items=call('GET','/api/v1/map/locations?limit=1').json()['items']
        if not items: raise RuntimeError('Import existing bins first')
        bin_=items[0]
        call('GET',f"/api/v1/bins/{bin_['id']}/view")
        call('GET',f"/api/v1/bins/{bin_['id']}/history")
        if not args.write_demo:
            print('PASS: health, OpenAPI, map, Bin view and history (read-only)')
            return
        tokens={}
        for role in ('citizen','staff','admin'):
            password=values.get(f'DEMO_{role.upper()}_PASSWORD')
            if not password: raise RuntimeError(f'Missing DEMO_{role.upper()}_PASSWORD')
            result=call('POST','/api/v1/auth/demo/login',body=dict(account='demo-'+role,password=password)).json()
            tokens[role]=result['access_token']
        def photo(role,purpose):
            output=io.BytesIO(); Image.new('RGB',(64,64),(100,150,100)).save(output,'JPEG')
            return call('POST','/api/v1/media',tokens[role],files={'file':('explicit-demo.jpg',output.getvalue(),'image/jpeg')},data={'purpose':purpose}).json()['id']
        report=call('POST','/api/v1/reports',tokens['citizen'],dict(bin_id=bin_['id'],type='full',description='明示 API 展示驗收',
            photo_ids=[photo('citizen','report')],position=dict(latitude=bin_['latitude'],longitude=bin_['longitude']),quick=False)).json()
        work=report['work_order_id']
        if work is None: raise RuntimeError('Use a Daan bin for the staff demo')
        def work_call(action,body,role='staff'):
            prefix='admin' if role=='admin' else 'staff'
            detail=call('GET',f'/api/v1/{prefix}/work-orders/{work}',tokens[role])
            return call('POST',f'/api/v1/{prefix}/work-orders/{work}/{action}',tokens[role],body,detail.headers['ETag']).json()
        detail=call('GET',f'/api/v1/staff/work-orders/{work}',tokens['staff']).json()['work_order']
        if detail['status']=='pending': work_call('accept',{})
        detail=call('GET',f'/api/v1/staff/work-orders/{work}',tokens['staff']).json()['work_order']
        if detail['status']=='processing': work_call('arrive',{})
        detail=call('GET',f'/api/v1/staff/work-orders/{work}',tokens['staff']).json()
        # A second citizen's evidence must not be automatically verified by a smoke test.
        if any(r['id']!=report['id'] and r['settled_at'] is None for r in detail['reports']):
            raise RuntimeError('Other unreviewed reports exist; finish them manually')
        if report['settled_at'] is None:
            work_call(f"reports/{report['id']}/review",dict(decision='approved',reason=None))
        if not detail['work_order']['photo_at']:
            work_call('evidence',dict(media_id=photo('staff','completion'),purpose='completion'))
        work_call('finish',{})
        detail=call('GET',f'/api/v1/staff/work-orders/{work}',tokens['staff']).json()['work_order']
        if detail['status']=='waiting_sensor': work_call('demo-clear',dict(reading_id=str(uuid4())),'admin')
        final=call('GET',f'/api/v1/staff/work-orders/{work}',tokens['staff']).json()['work_order']
        assert final['status']=='completed'
        call('GET','/api/v1/me/membership',tokens['citizen'])
        for token in tokens.values(): call('DELETE','/api/v1/auth/session',token)
        print('PASS: explicit demo report -> review/settlement -> evidence -> clear -> completion')


if __name__ == '__main__': main()
