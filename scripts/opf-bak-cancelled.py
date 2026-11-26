"""List reservations cancelled in the กองอาคาร backup (meeting sheet, Remark contains 'ยกเลิกโดย').
Usage: python scripts/opf-bak-cancelled.py <backup.xlsx> [out.json]   -> old/opf/opf-bak-cancelled.json
Then:  node scripts/opf-cancel-sync.js [--commit]
"""
import openpyxl, json, re, sys, datetime as dt

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'old/opf/opf-bak-cancelled.json'
wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
rows = []
for x in list(wb['meeting'].iter_rows(values_only=True))[1:]:
    remark = str(x[22] or '')
    if 'ยกเลิกโดย' not in remark:
        continue
    m = re.search(r'ยกเลิกโดย\s*(.*?)\s*เวลา\s*(\d+/\d+/\d{4} \d+:\d+:\d+ [AP]M)', remark)
    at = dt.datetime.strptime(m.group(2), '%m/%d/%Y %I:%M:%S %p').isoformat() if m else None
    rows.append({'id': str(x[0]), 'old_room': x[2], 'date': str(x[5])[:10], 'title': (x[21] or '').strip(),
                 'cancelledBy': m.group(1) if m else None, 'cancelledAt': at})
json.dump(rows, open(out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('cancelled in backup:', len(rows), '->', out)
