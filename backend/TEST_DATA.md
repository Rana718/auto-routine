# Test Data Reference

## Delivery Code System (Shop1 - A1)

Based on the client's reference document, the SKU format includes delivery codes:

### Format: `a-iv-XXX-Y-ZZ`
- `a-iv`: Prefix
- `XXX`: Category code (066, 067, 068, etc.)
- `Y`: Item number
- `ZZ`: Delivery code

### Delivery Codes:
- **aa**: 即日 (Same day delivery)
- **bb**: 5営業日以内 (Within 5 business days)
- **cc**: 7-14日営業日以内 (Within 7-14 business days)

## Test Data Overview

### Stores (5 locations)
1. ヨドバシカメラ 秋葉原店 (A1-001) - 家電
2. ビックカメラ 新宿東口店 (A1-002) - 家電
3. ドン・キホーテ 渋谷店 (A1-003) - 日用品
4. マツモトキヨシ 六本木店 (A1-004) - ドラッグストア
5. 成城石井 麻布十番店 (A1-005) - 食品・飲料

### Products (8 items with delivery codes)
1. `a-iv-066-1-aa` - ソニー ワイヤレスイヤホン (Same day)
2. `a-iv-066-2-bb` - パナソニック ドライヤー (5 days)
3. `a-iv-066-3-cc` - シャープ 空気清浄機 (7-14 days)
4. `a-iv-067-1-aa` - ネスカフェ ゴールドブレンド (Same day)
5. `a-iv-067-2-bb` - 明治 ザ・チョコレート (5 days)
6. `a-iv-068-1-aa` - 花王 アタック 洗濯洗剤 (Same day)
7. `a-iv-068-2-cc` - ユニ・チャーム マスク (7-14 days)
8. `a-iv-069-1-bb` - ロート製薬 目薬 (5 days)

### Staff (4 members)
- **Admin**: admin@example.com / admin123
- **Supervisor**: suzuki@example.com / password123
- **Buyer 1**: tanaka@example.com / password123
- **Buyer 2**: sato@example.com / password123

### Orders (10 test orders)
- Robot-in Order IDs: RO-2025-1001 to RO-2025-1010
- Mix of 楽天市場 and Amazon
- Each order has 2-4 items
- Target purchase date: Today

## Running the Test

```bash
cd backend
python test_data.py
```

This will:
1. Clear all existing data
2. Create stores, products, staff, orders
3. Map products to stores
4. Generate order items with delivery priorities

## Priority Logic
- Items with `aa` delivery code → High priority (same day)
- Items with `bb` delivery code → Normal priority
- Items with `cc` delivery code → Normal priority
