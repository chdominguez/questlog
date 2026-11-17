// One Python harness for both runners: Pyodide in the browser worker, `python3` in the validator.
// It mirrors runKata: same TestResult shape, user code run fresh before each test, tests are
// function bodies that `return eq(got, expected)`.
export const PY_HARNESS = String.raw`
import contextlib, io, json, textwrap

MAX_LOGS = 200

def _eq(got, expected):
    return {"pass": got == expected, "got": got, "expected": expected}

def run_kata_json(source, tests_json):
    tests = json.loads(tests_json)
    try:
        code = compile(source, "<kata>", "exec")
    except SyntaxError as e:
        err = f"Compile error. SyntaxError: {e.msg} (line {e.lineno})"
        return json.dumps([{"name": t["name"], "pass": False, "error": err, "logs": []} for t in tests])
    out = []
    for t in tests:
        buf = io.StringIO()
        res = {"name": t["name"], "pass": False, "logs": []}
        try:
            ns = {"eq": _eq, "__name__": "__kata__"}
            with contextlib.redirect_stdout(buf):
                exec(code, ns)
                exec(compile("def __t():\n" + textwrap.indent(t["code"], "    "), "<test>", "exec"), ns)
                r = ns["__t"]()
            if not isinstance(r, dict) or "pass" not in r:
                res["error"] = "Test did not return eq(...)"
            else:
                res.update({"pass": bool(r["pass"]), "got": repr(r["got"]), "expected": repr(r["expected"])})
        except BaseException as e:
            res["error"] = f"{type(e).__name__}: {e}"
        lines = buf.getvalue().splitlines()
        res["logs"] = lines[:MAX_LOGS] + (["… (truncated)"] if len(lines) > MAX_LOGS else [])
        out.append(res)
    return json.dumps(out)
`;
