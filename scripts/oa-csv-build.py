# Build old/oa/oa-bookings-<name>.json for scripts/import-oa.js from an export of the old
# สำนักอำนวยการ system (CSV, dates M/D/YYYY H:MM, Bangkok time).
#   python scripts/oa-csv-build.py scripts/oa_imgrate_23Nov2026.csv old/oa/oa-bookings-20261123.json
# Keeps status 2 (approved) only; status 4 (cancelled) is reported, not imported.
#   python scripts/oa-csv-build.py <csv> old/oa/oa-cancelled-20261123.json --status=4
# writes the cancelled rows instead, for scripts/oa-cancel-sync.js.
import csv, json, sys, collections
from datetime import datetime

ROOM_CODE = {"1": "M241601", "2": "M241502", "3": "M241504", "4": "M241503", "5": "M241501"}

def dt(s):
    s = s.strip()
    for f in ("%m/%d/%Y %H:%M", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, f)
        except ValueError:
            pass
    raise ValueError(f"bad date {s!r}")

clean = lambda v: "" if v is None or v.strip() in ("", "NULL") else " ".join(v.split())
fmt = lambda d: d.strftime("%Y-%m-%d %H:%M:%S")

src, dst = sys.argv[1], sys.argv[2]
KEEP = next((a.split("=", 1)[1] for a in sys.argv[3:] if a.startswith("--status=")), "2")
rows = list(csv.DictReader(open(src, encoding="utf-8-sig")))
out, skipped = [], collections.Counter()
for r in rows:
    if r["status"] != KEEP:
        skipped[f"status {r['status']}"] += 1
        continue
    code = ROOM_CODE.get(r["room_id"])
    if not code:
        skipped[f"room_id {r['room_id']} ({clean(r['name_3'])}) has no room"] += 1
        continue
    lines = [f"ผู้ขอใช้: {clean(r['person_name']) or '-'}"]
    for label, key in (("สำหรับ", "manager"), ("โทร", "tel"), ("ผู้เข้าร่วม", "human_name"), ("หมายเหตุ", "comment")):
        if clean(r[key]):
            lines.append(f"{label}: {clean(r[key])}")
    out.append({
        "docno": r["docno"],
        "room_code": code,
        "title": clean(r["title"]) or "-",
        "attendees": int(float(r["human_amount"] or 0)),
        "startTime": fmt(dt(r["start_date"])),
        "endTime": fmt(dt(r["end_date"])),
        "decisionNote": clean(r["approve_comment"]) or "ระบบอนุมัติจองอัตโนมัติ",
        "createdAt": fmt(dt(r["date_create"])),
        "updatedAt": fmt(dt(r["date_edit"])),
        "description": "\n".join(lines),
    })
out.sort(key=lambda o: o["startTime"])
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"rows: {len(rows)}, kept: {len(out)} {dict(collections.Counter(o['room_code'] for o in out))}")
print(f"skipped: {dict(skipped)}")
print(f"start range: {out[0]['startTime']} .. {out[-1]['startTime']}")
