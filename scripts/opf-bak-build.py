"""Build import JSON from a newer กองอาคาร backup (e.g. opf_bak_25Nov2026.xlsx).

The backup has two sheets:
  meeting   : iDres, CO_T, Room, Room_Des, Cap, Date_Used, Date_Reserved, NameRes, P1..P13, Question
  classroom : iDres, CO_T, Room (empty), Room_Des (10301/10302/10303), Cap, Date_Used, Date_Reserved, NameRes,
              P1..P11, D (title), ...
Rows whose Remark says 'ยกเลิกโดย' are cancelled and skipped; the rest -> APPROVED. Periods: P1 = 08:00, one hour each, latest end 20:00 (same as opf-build.py).
Only rooms that exist in our system are kept (MAP from opf-build.py + CLASSROOM below, checked against rooms.json).

Usage:  python scripts/opf-bak-build.py <backup.xlsx> [out.json]
        (rooms.json from: node scripts/opf-export-rooms.js)
Then:   node scripts/import-opf.js --file=<out.json>   (dry run, add --commit to insert)
"""
import openpyxl, collections, json, sys, datetime as dt

S = 'old/opf'
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else S + '/opf-bak-bookings.json'
rooms = {r['code']: r for r in json.load(open(S + '/rooms.json', encoding='utf8'))}

# Same mapping as opf-build.py (used for the first import).
MAP = {
    'B15F1': 'E150101', 'B3F4': 'E030401', 'B10F3': 'E100301', 'B5F9': 'E050901',
    'B10F5QPS': 'M100503', 'B21F7(Chicago)': 'M210704', 'B24F18': 'E241801',
    'B15F1SBF': 'M000101', 'B7F12': 'E071201', 'B10F2': 'S100201',
}
CLASSROOM = {'10301': 'S100302', '10302': 'S100303', '10303': 'S100304'}


def runs(pat):
    out, i = [], 0
    while i < len(pat):
        if pat[i] == 'R':
            j = i
            while j < len(pat) and pat[j] == 'R':
                j += 1
            out.append((i, j))  # 0-based start period, exclusive end
            i = j
        else:
            i += 1
    return out


def at(date, p):
    return dt.datetime.combine(date.date(), dt.time(8 + p, 0))


wb = openpyxl.load_workbook(src, data_only=True)
rows, skipped = [], collections.Counter()

for x in wb['meeting'].iter_rows(min_row=2, values_only=True):
    iD, _, old, old_desc, cap, used, reserved, name = x[:8]
    pat, title = [str(v or '').strip() for v in x[8:21]], (x[21] or '').strip()
    # Remark "ระบบถูกยกเลิกโดย ..." = cancelled in the old system (see opf-bak-cancelled.py / opf-cancel-sync.js).
    if 'ยกเลิกโดย' in str(x[22] or ''):
        skipped['cancelled in old system'] += 1
        continue
    code = MAP.get(old)
    if not code or code not in rooms:
        skipped[f'{old} {old_desc}'] += 1
        continue
    for a, b in runs(pat):
        rows.append({'old_ReserveID': iD, 'old_room': old, 'room_code': code, 'title': title,
                     'startTime': str(at(used, a)), 'endTime': str(at(used, min(b, 12))), 'attendees': 1,
                     'status': 'APPROVED', 'booked_by_name(old)': name, 'old_createDate': str(reserved),
                     'old_remark': None})

for x in wb['classroom'].iter_rows(min_row=2, values_only=True):
    iD, _, _, old, cap, used, reserved, name = x[:8]
    pat, title = [str(v or '').strip() for v in x[8:19]], str(x[19] or '').strip()
    code = CLASSROOM.get(str(old))
    if not code or code not in rooms:
        skipped[f'classroom {old}'] += 1
        continue
    for a, b in runs(pat):
        rows.append({'old_ReserveID': f'C{iD}', 'old_room': str(old),  # classroom ids are a separate table: prefix C
                     'room_code': code,
                     'title': title or f'ใช้ห้องเรียน {old} (ระบบเดิม)', 'startTime': str(at(used, a)),
                     'endTime': str(at(used, min(b, 12))), 'attendees': 1, 'status': 'APPROVED',
                     'booked_by_name(old)': name, 'old_createDate': str(reserved), 'old_remark': None})

rows.sort(key=lambda r: (r['startTime'], r['room_code']))
json.dump(rows, open(out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('wrote', len(rows), 'bookings to', out)
print('by room:', dict(collections.Counter(r['room_code'] for r in rows)))
print('skipped rows (room not in our system):', sum(skipped.values()))
for k, v in skipped.most_common():
    print(f'  {v:4} {k}')
