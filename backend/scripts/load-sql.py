import json, os, sys, time, urllib.request, urllib.error, glob

acct=os.environ["CLOUDFLARE_ACCOUNT_ID"]; db=os.environ["CLOUDFLARE_D1_DATABASE_ID"]; tok=os.environ["CLOUDFLARE_API_TOKEN"]
URL=f"https://api.cloudflare.com/client/v4/accounts/{acct}/d1/database/{db}/query"

def post(sql, attempt=1):
    req=urllib.request.Request(URL, data=json.dumps({"sql":sql}).encode(),
        headers={"Authorization":f"Bearer {tok}","Content-Type":"application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:400]
        # 5xx and rate limits are worth another go; a constraint error is not.
        if e.code in (429, 500, 502, 503, 504) and attempt < 4:
            time.sleep(3 * attempt); return post(sql, attempt + 1)
        return {"success": False, "errors": [{"code": e.code, "message": body}]}
    except Exception as ex:
        if attempt < 4: time.sleep(3 * attempt); return post(sql, attempt + 1)
        return {"success": False, "errors": [{"message": str(ex)}]}

files = sorted(glob.glob(os.path.join(sys.argv[1], "*.sql")))
if len(sys.argv) > 2: files = files[:int(sys.argv[2])]
t0=time.time(); done=0
for i, f in enumerate(files, 1):
    sql = open(f).read()
    s=time.time(); res = post(sql); el=time.time()-s
    if not res.get("success"):
        print(f"FAILED {os.path.basename(f)}: {json.dumps(res.get('errors'))[:400]}"); sys.exit(1)
    done += len(res.get("result", []))
    print(f"[{i}/{len(files)}] {os.path.basename(f)}  {len(sql)/1e6:.2f}MB  {el:.1f}s", flush=True)
print(f"OK  {len(files)} files, {done} statements, {time.time()-t0:.0f}s total")
