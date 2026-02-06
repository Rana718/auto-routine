"""
Script to parse client's purchase list CSV and extract:
1. Stores master data
2. Products master data
3. Product-Store mappings
4. Test orders

Usage:
    python scripts/parse_client_csv.py <input_csv_path> <output_directory>
"""

import csv
import re
import sys
import io
from pathlib import Path

# Fix Windows console encoding for Japanese characters
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class Store:
    name: str
    address: str
    postal_code: str = ""
    district: str = ""
    floor_info: str = ""

    def __hash__(self):
        return hash(self.name)

    def __eq__(self, other):
        return self.name == other.name


@dataclass
class Product:
    sku: str
    name: str
    delivery_options: Set[str] = field(default_factory=set)


@dataclass
class ProductStoreMapping:
    sku: str
    store_name: str
    total_quantity: int = 0


def extract_postal_code(address: str) -> Tuple[str, str]:
    """Extract postal code from address string."""
    match = re.search(r'〒(\d{3}-?\d{4})', address)
    if match:
        postal_code = match.group(1)
        # Remove postal code from address for cleaner data
        clean_address = re.sub(r'日本、〒\d{3}-?\d{4}\s*', '', address).strip()
        return postal_code, clean_address
    return "", address


def extract_district(address: str) -> str:
    """Extract district (区) from address. Supports any Japanese city."""
    # General pattern: city + district (e.g., 大阪市中央区, 堺市北区, 尼崎市...)
    match = re.search(r'(?:都|道|府|県)\w+?市(\w+区)', address)
    if match:
        return match.group(1)
    return ""


def extract_floor_info(store_name: str) -> Tuple[str, str]:
    """Extract floor info from store name."""
    # Common patterns: 地下1F, 1F, 2F, B1, B1F, 本館1F
    match = re.search(r'(地下\d+F?|\d+F|B\d+F?|本館\d+F|南館\d+F)', store_name)
    if match:
        floor = match.group(1)
        # Clean store name (optional - keep full name for now)
        return floor, store_name
    return "", store_name


def parse_delivery_option(spec: str) -> str:
    """Extract delivery timing from specification field."""
    if not spec:
        return ""

    # Common patterns
    patterns = [
        r'即日発送',
        r'5営業日以内の発送',
        r'7営業日〜14営業日以内の発送',
        r'7営業日から14営業日以内の発送',
    ]

    for pattern in patterns:
        if re.search(pattern, spec):
            match = re.search(pattern, spec)
            return match.group(0)

    return ""


def parse_client_csv(input_path: str) -> Tuple[Dict[str, Store], Dict[str, Product], List[ProductStoreMapping]]:
    """Parse the client's CSV and extract all data."""

    stores: Dict[str, Store] = {}
    products: Dict[str, Product] = {}
    mappings: List[ProductStoreMapping] = []
    mapping_quantities: Dict[Tuple[str, str], int] = defaultdict(int)

    current_sku = ""
    current_product_name = ""

    with open(input_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        rows = list(reader)

    # Skip header rows (first 7 rows based on structure)
    data_rows = rows[7:]

    for row in data_rows:
        if len(row) < 7:
            continue

        # Column mapping: B=1, C=2, D=3, E=4, F=5, G=6
        sku = row[1].strip() if len(row) > 1 else ""
        product_name = row[2].strip() if len(row) > 2 else ""
        spec = row[3].strip() if len(row) > 3 else ""
        quantity_str = row[4].strip() if len(row) > 4 else ""
        store_name = row[5].strip() if len(row) > 5 else ""
        address = row[6].strip() if len(row) > 6 else ""

        # Skip empty rows
        if not store_name and not quantity_str:
            continue

        # Handle continuation rows (same product, different store)
        if sku:
            current_sku = sku
            current_product_name = product_name
        else:
            sku = current_sku
            product_name = current_product_name

        # Skip if still no SKU
        if not sku:
            continue

        # Parse quantity
        try:
            quantity = int(quantity_str) if quantity_str else 0
        except ValueError:
            quantity = 0

        # Extract store data
        if store_name:
            postal_code, clean_address = extract_postal_code(address)
            district = extract_district(address)
            floor_info, _ = extract_floor_info(store_name)

            if store_name not in stores:
                stores[store_name] = Store(
                    name=store_name,
                    address=clean_address or address,
                    postal_code=postal_code,
                    district=district,
                    floor_info=floor_info
                )

        # Extract product data
        if sku not in products:
            products[sku] = Product(sku=sku, name=product_name)

        # Add delivery option if present
        delivery_opt = parse_delivery_option(spec)
        if delivery_opt:
            products[sku].delivery_options.add(delivery_opt)

        # Create product-store mapping
        if sku and store_name and quantity > 0:
            key = (sku, store_name)
            mapping_quantities[key] += quantity

    # Convert mapping quantities to list
    for (sku, store_name), total_qty in mapping_quantities.items():
        mappings.append(ProductStoreMapping(
            sku=sku,
            store_name=store_name,
            total_quantity=total_qty
        ))

    return stores, products, mappings


def write_stores_csv(stores: Dict[str, Store], output_path: str):
    """Write stores to CSV file."""
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'store_name', 'store_code', 'address', 'district',
            'postal_code', 'floor_info', 'category', 'priority_level', 'is_active'
        ])

        for i, store in enumerate(stores.values(), 1):
            # Generate store code from name
            store_code = f"STORE-{i:04d}"

            writer.writerow([
                store.name,
                store_code,
                store.address,
                store.district,
                store.postal_code,
                store.floor_info,
                "",  # category - to be filled manually
                2,   # default priority
                True
            ])

    print(f"  Stores: {len(stores)} records -> {output_path}")


def write_products_csv(products: Dict[str, Product], output_path: str):
    """Write products to CSV file."""
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'sku', 'product_name', 'category', 'delivery_options',
            'is_set_product', 'is_store_fixed', 'exclude_from_routing'
        ])

        for product in products.values():
            delivery_opts = "; ".join(product.delivery_options) if product.delivery_options else ""

            writer.writerow([
                product.sku,
                product.name,
                "",  # category - to be determined
                delivery_opts,
                False,  # is_set_product
                False,  # is_store_fixed
                False   # exclude_from_routing
            ])

    print(f"  Products: {len(products)} records -> {output_path}")


def write_mappings_csv(mappings: List[ProductStoreMapping], output_path: str):
    """Write product-store mappings to CSV file."""
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'sku', 'store_name', 'total_quantity', 'is_primary_store',
            'priority', 'stock_status'
        ])

        # Group by SKU to determine primary store (highest quantity)
        sku_max_qty: Dict[str, int] = defaultdict(int)
        for m in mappings:
            if m.total_quantity > sku_max_qty[m.sku]:
                sku_max_qty[m.sku] = m.total_quantity

        for m in mappings:
            is_primary = m.total_quantity == sku_max_qty[m.sku]

            writer.writerow([
                m.sku,
                m.store_name,
                m.total_quantity,
                is_primary,
                1 if is_primary else 2,  # priority
                "in_stock"  # assume in stock
            ])

    print(f"  Mappings: {len(mappings)} records -> {output_path}")


def write_test_orders_csv(products: Dict[str, Product], mappings: List[ProductStoreMapping], output_path: str):
    """Generate test orders CSV based on extracted data."""
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'robot_in_order_id', 'mall_name', 'customer_name', 'order_date',
            'sku', 'product_name', 'quantity'
        ])

        # Create sample orders (first 20 products)
        sample_products = list(products.values())[:20]

        for i, product in enumerate(sample_products, 1):
            order_id = f"TEST-{i:04d}"

            writer.writerow([
                order_id,
                "テストモール",
                f"テスト顧客 {i}",
                "2026-02-04T10:00:00",
                product.sku,
                product.name[:100],  # Truncate long names
                1
            ])

    print(f"  Test Orders: {len(sample_products)} records -> {output_path}")


def write_summary(stores: Dict[str, Store], products: Dict[str, Product],
                  mappings: List[ProductStoreMapping], output_path: str):
    """Write summary report."""

    # Count unique SKUs per store
    store_product_count: Dict[str, int] = defaultdict(int)
    for m in mappings:
        store_product_count[m.store_name] += 1

    # Top stores by product count
    top_stores = sorted(store_product_count.items(), key=lambda x: x[1], reverse=True)[:20]

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("=" * 60 + "\n")
        f.write("  CSV EXTRACTION SUMMARY REPORT\n")
        f.write("=" * 60 + "\n\n")

        f.write(f"Total Stores:   {len(stores)}\n")
        f.write(f"Total Products: {len(products)}\n")
        f.write(f"Total Mappings: {len(mappings)}\n\n")

        f.write("-" * 60 + "\n")
        f.write("TOP 20 STORES BY PRODUCT COUNT:\n")
        f.write("-" * 60 + "\n")
        for store_name, count in top_stores:
            f.write(f"  {count:3d} products: {store_name[:50]}\n")

        f.write("\n")
        f.write("-" * 60 + "\n")
        f.write("DISTRICTS FOUND:\n")
        f.write("-" * 60 + "\n")
        districts = set(s.district for s in stores.values() if s.district)
        for d in sorted(districts):
            f.write(f"  - {d}\n")

        f.write("\n")
        f.write("-" * 60 + "\n")
        f.write("DELIVERY OPTIONS FOUND:\n")
        f.write("-" * 60 + "\n")
        all_options = set()
        for p in products.values():
            all_options.update(p.delivery_options)
        for opt in sorted(all_options):
            f.write(f"  - {opt}\n")

    print(f"  Summary: {output_path}")


def main():
    if len(sys.argv) < 2:
        # Default paths
        script_dir = Path(__file__).parent.parent.parent
        input_path = script_dir / "購入リスト店舗入力.csv"
        output_dir = script_dir / "import_data"
    else:
        input_path = Path(sys.argv[1])
        output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else input_path.parent / "import_data"

    # Create output directory
    output_dir.mkdir(exist_ok=True)

    print(f"\nParsing: {input_path}")
    print(f"Output:  {output_dir}\n")

    # Parse CSV
    stores, products, mappings = parse_client_csv(str(input_path))

    print("Generating CSV files:")

    # Write output files
    write_stores_csv(stores, str(output_dir / "stores.csv"))
    write_products_csv(products, str(output_dir / "products.csv"))
    write_mappings_csv(mappings, str(output_dir / "product_store_mappings.csv"))
    write_test_orders_csv(products, mappings, str(output_dir / "test_orders.csv"))
    write_summary(stores, products, mappings, str(output_dir / "summary.txt"))

    print(f"\nDone! Files saved to: {output_dir}")


if __name__ == "__main__":
    main()
