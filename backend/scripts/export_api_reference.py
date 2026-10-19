"""Render exact parameter/DTO tables from the versioned OpenAPI snapshot."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def link(name):
    return f"[{name}](#schema-{name.lower().replace('_', '-')})"


def describe(schema):
    if "$ref" in schema:
        return link(schema["$ref"].split("/")[-1])
    if "anyOf" in schema or "oneOf" in schema:
        return " / ".join(describe(v) for v in schema.get("anyOf", schema.get("oneOf")))
    if "allOf" in schema:
        return " & ".join(describe(v) for v in schema["allOf"])
    if "const" in schema:
        return f'`{json.dumps(schema["const"], ensure_ascii=False)}`'
    if "enum" in schema:
        return "、".join(f'`{json.dumps(v, ensure_ascii=False)}`' for v in schema["enum"])
    kind = schema.get("type", "object")
    if kind == "array":
        return f'Array&lt;{describe(schema.get("items", {}))}&gt;'
    if kind == "object" and isinstance(schema.get("additionalProperties"), dict):
        return f'Record&lt;string, {describe(schema["additionalProperties"])}&gt;'
    return kind + (f' ({schema["format"]})' if "format" in schema else "")


def constraints(schema):
    parts = []
    for key, label in [("minimum", "最小"), ("maximum", "最大"),
                       ("exclusiveMinimum", "大於"), ("exclusiveMaximum", "小於"),
                       ("minLength", "最短字元"), ("maxLength", "最長字元"),
                       ("minItems", "最少項數"), ("maxItems", "最多項數"),
                       ("pattern", "格式")]:
        if key in schema:
            parts.append(f'{label} `{schema[key]}`')
    if "default" in schema:
        parts.append(f'預設 `{json.dumps(schema["default"], ensure_ascii=False)}`')
    if schema.get("additionalProperties") is False:
        parts.append("禁止未宣告欄位")
    if schema.get("description"):
        parts.append(schema["description"].replace("\n", " ").replace("|", "／"))
    for branch in schema.get('anyOf', schema.get('oneOf', schema.get('allOf', []))):
        detail = constraints(branch)
        if detail != '—':
            parts.append(detail)
    return "；".join(parts) or "—"


def main():
    spec = json.loads((ROOT / "docs/openapi.json").read_text())
    lines = ["# API Reference：完整參數與 DTO", "",
        "由 [OpenAPI 快照](openapi.json) 產生。先讀 [前端串接指南](FRONTEND_INTEGRATION.md) 的登入、範例及畫面流程，再用本頁查每個 endpoint 的精確欄位。業務規則、權限與錯誤處理見 [API 契約](API_CONTRACT.md)。",
        "", "本頁所有 path 已含 `/api/v1`（health 除外）。必填＝欄位不能省略；允許 null＝值可為 null，兩者不同。JSON response 不省略 null。DTO 為傳輸格式，無須了解 ORM。日期 `date-time` 使用 UTC ISO 8601。",
        "", "成功回應旁列完整型別連結；每個 DTO 的欄位均在下方。Request 限制由 Pydantic 與業務規則共同驗證。新 API 的 Idempotency-Key／If-Match 在各 endpoint 參數表列出；Authorization 依權限表使用，並非每個 query 參數。",
        "", "重建：在 backend/ 執行 `python -m scripts.export_openapi` 後，執行 `python -m scripts.export_api_reference`。", "",
        "## Endpoint 索引", "", "| Method | Path | 成功回應 |", "| --- | --- | --- |"]
    operations = []
    for path, item in spec["paths"].items():
        for method, op in item.items():
            if method not in {"get", "post", "patch", "delete", "put"}:
                continue
            operations.append((path, method, op))
            responses = []
            for status, response in op["responses"].items():
                if status.startswith("2"):
                    content = response.get("content", {})
                    schemas = [describe(v.get("schema", {})) for v in content.values()]
                    responses.append(status + " " + (" / ".join(schemas) or "無 body"))
            lines.append(f'| {method.upper()} | `{path}` | {"；".join(responses)} |')
    lines.extend(["", "## Endpoint 詳情", ""])
    for path, method, op in operations:
        lines.extend([f'### {method.upper()} `{path}`', ""])
        if op.get("deprecated"):
            lines.extend(["**Deprecated：相容用途；新增串接優先用 Bin API。**", ""])
        params = op.get("parameters", [])
        if params:
            lines.extend(["| 位置 | 名稱 | 必填 | 型別／允許值 | 限制／預設 |", "| --- | --- | --- | --- | --- |"])
            for p in params:
                schema = p.get("schema", {})
                lines.append(f'| {p["in"]} | `{p["name"]}` | {"是" if p.get("required") else "否"} | {describe(schema)} | {constraints(schema)} |')
            lines.append("")
        else:
            lines.extend(["無 path／query／額外命令 header 參數（仍依權限帶 Bearer）。", ""])
        body = op.get("requestBody")
        if body:
            for mime, content in body["content"].items():
                lines.extend([f'Request：`{mime}`，{"必填" if body.get("required") else "可省略"}；{describe(content.get("schema", {}))}。', ""])
        else:
            lines.extend(["Request body：無。", ""])
        lines.extend(["| HTTP | Response |", "| --- | --- |"])
        for status, response in op["responses"].items():
            schemas = [describe(v.get("schema", {})) for v in response.get("content", {}).values()]
            lines.append(f'| {status} | {" / ".join(schemas) or "無 body"} |')
        lines.append("")
    lines.extend(["## DTO 欄位", ""])
    for name, schema in spec["components"]["schemas"].items():
        anchor = name.lower().replace('_', '-')
        lines.extend([f'<a id="schema-{anchor}"></a>', "", f'### Schema {name}', ""])
        if schema.get("type") != "object":
            lines.extend([describe(schema), ""])
            continue
        lines.extend([constraints(schema), "", "| 欄位 | 必填 | 型別／允許值 | 限制／預設 |", "| --- | --- | --- | --- |"])
        for name_, prop in schema.get("properties", {}).items():
            lines.append(f'| `{name_}` | {"是" if name_ in schema.get("required", []) else "否"} | {describe(prop)} | {constraints(prop)} |')
        lines.append("")
    target = ROOT / "docs/API_REFERENCE.md"
    target.write_text("\n".join(lines).rstrip() + "\n")
    print(f'Exported {len(operations)} operations and {len(spec["components"]["schemas"])} schemas to {target.name}')


if __name__ == "__main__":
    main()
