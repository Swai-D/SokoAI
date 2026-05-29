import pdfplumber
import re
from datetime import datetime
import os
import pandas as pd

COMMODITY_MAPPING = {
    "Maize": (2, 3),
    "Rice": (4, 5),
    "Ngano": (12, 13),
    "Beans": (14, 15),
    "Irish Potatoes": (16, 17)
}

# The 5 primary markets in DSM to focus on
DSM_TARGET_MARKETS = ["Ilala", "Tandika", "Temeke", "Tandale", "Mabibo", "Buguruni", "Ubungo"]

def clean_price(price_str):
    if not price_str or price_str.upper() == "NA":
        return None
    price_str = re.sub(r'[\s,]', '', str(price_str))
    try:
        return float(price_str)
    except ValueError:
        return None

def parse_price_pdf(pdf_path, date_obj):
    results = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                table = page.extract_table()
                if not table:
                    continue
                
                for row in table:
                    if not row or len(row) < 18:
                        continue
                    
                    region = str(row[0]).strip()
                    # Filter for Dar es Salaam
                    if "Dar es" not in region:
                        continue
                        
                    market = str(row[1]).strip()
                    # Optional: filter for specific markets if needed
                    # if market not in DSM_TARGET_MARKETS: continue
                    
                    for commodity, (min_idx, max_idx) in COMMODITY_MAPPING.items():
                        min_p = clean_price(row[min_idx])
                        max_p = clean_price(row[max_idx])
                        
                        if min_p is not None and max_p is not None:
                            avg_p = (min_p + max_p) / 2
                            price_per_kg = avg_p / 100
                            
                            results.append({
                                "date": date_obj.strftime("%Y-%m-%d"),
                                "region": "Dar es Salaam",
                                "market": market,
                                "commodity": commodity,
                                "price": round(price_per_kg, 2),
                                "unit": "kg"
                            })
    except Exception as e:
        print(f"Error parsing {pdf_path}: {e}")
    return results

def extract_date_from_str(text):
    if not text: return None
    sw_months = {
        "JANUARI": "January", "FEBRUARI": "February", "MACHI": "March", 
        "APRILI": "April", "MEI": "May", "JUNI": "June", 
        "JULAI": "July", "AGOSTI": "August", "SEPTEMBA": "September", 
        "OKTOBA": "October", "NOVEMBA": "November", "DESEMBA": "December",
        "OCTOBA": "October", "SEPETEMBA": "September", "FEBRUALI": "February"
    }
    
    clean_text = text.upper().replace('\n', ' ').replace('_', ' ')
    for sw, en in sw_months.items():
        clean_text = clean_text.replace(sw, en)
        
    # Matches "06 MAY 2026", "06MAY2026", "6 JUNE 2024", "10 APRIL 2026", etc.
    patterns = [
        r'(\d{1,2})\s+([A-Z]+),?\s+(\d{4})',
        r'(\d{1,2})([A-Z]+),?\s+(\d{4})',
        r'(\d{1,2})([A-Z]+)(\d{4})',
        r'(\d{1,2})\s+([A-Z]+)\s+(\d{4})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, clean_text)
        if match:
            d, m, y = match.groups()
            try:
                return datetime.strptime(f"{d} {m} {y}", "%d %B %Y")
            except:
                continue
    return None

def process_all_pdfs(raw_dir, output_csv):
    all_data = []
    files = [f for f in os.listdir(raw_dir) if f.endswith(".pdf")]
    print(f"Processing {len(files)} PDFs...")
    
    for filename in files:
        filepath = os.path.join(raw_dir, filename)
        date_obj = None
        
        # 1. Try date from filename
        # Handles "20230529_..." OR "unknown_Bei_ya_bidhaa_th_01_April_2026.pdf"
        date_str = filename.split('_')[0]
        if date_str.isdigit() and len(date_str) == 8:
            try:
                date_obj = datetime.strptime(date_str, "%Y%m%d")
            except:
                pass
        
        if not date_obj:
            date_obj = extract_date_from_str(filename)
            
        # 2. Try date from content
        if not date_obj:
            try:
                with pdfplumber.open(filepath) as pdf:
                    first_page = pdf.pages[0].extract_text()
                    date_obj = extract_date_from_str(first_page)
            except Exception as e:
                print(f"Error reading {filename} for content date: {e}")
                
        if not date_obj:
            print(f"Skipping {filename}: Could not determine date.")
            continue
        
        data = parse_price_pdf(filepath, date_obj)
        all_data.extend(data)
        print(f"Parsed {len(data)} records from {filename} ({date_obj.strftime('%Y-%m-%d')})")

    if all_data:
        df = pd.DataFrame(all_data)
        # Average across markets for the same day and commodity
        df = df.groupby(['date', 'commodity']).agg({
            'price': 'mean',
            'unit': 'first',
            'region': 'first'
        }).reset_index()
        
        df.to_csv(output_csv, index=False)
        print(f"✅ Success! Saved {len(df)} averaged DSM records to {output_csv}")
    else:
        print("No data found to save.")

if __name__ == "__main__":
    import sys
    RAW_DIR = "data/raw_pdfs"
    OUTPUT = "bei_sokoni_dsm.csv"
    
    if len(sys.argv) > 1 and sys.argv[1] == "--bulk":
        process_all_pdfs(RAW_DIR, OUTPUT)
    else:
        # Test with sample if no args
        sample_pdf = "sw-1778146993-Wholesale Price 06th May, 2026.pdf"
        if os.path.exists(sample_pdf):
            test_date = datetime(2026, 5, 6)
            data = parse_price_pdf(sample_pdf, test_date)
            print(f"DSM Test parsed {len(data)} records.")
        else:
            print("Sample PDF not found. Use --bulk to process downloaded PDFs.")
