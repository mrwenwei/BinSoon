"""Export the running code's contract without querying the database."""
import argparse
import json
from pathlib import Path
from app.main import app


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',default='docs/openapi.json')
    args=parser.parse_args()
    path=Path(args.output)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(app.openapi(),ensure_ascii=False,indent=2,sort_keys=True)+'\n')
    print(f'Exported {len(app.openapi()["paths"])} paths to {path}')


if __name__ == '__main__': main()
