import requests
from bs4 import BeautifulSoup
import os
import pandas as pd
from datetime import datetime
from parser import parse_price_pdf
import urllib3
import re
import subprocess

# Disable SSL warnings for the MIT site
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://www.viwanda.go.tz/documents/product-prices-domestic"
DOWNLOAD_DIR = "data/raw_pdfs"
CSV_PATH = "data/bei_sokoni.csv"

def get_actual_pdf_link(pub_url):
    try:
        response = requests.get(pub_url, verify=False, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        for a in soup.find_all('a', href=True):
            if "download" in a['href'].lower() or "attachment" in a['href'].lower():
                link = a['href']
                if not link.startswith("http"):
                    link = "https://www.viwanda.go.tz" + link
                return link
    except Exception as e:
        print(f"Error finding PDF link: {e}")
    return None

def parse_date_from_text(text):
    sw_months = {
        "Januari": "January", "Februari": "February", "Machi": "March", 
        "Aprili": "April", "Mei": "May", "Juni": "June", 
        "Julai": "July", "Agosti": "August", "Septemba": "September", 
        "Oktoba": "October", "Novemba": "November", "Desemba": "December",
        "Octoba": "October", "Sepetemba": "September"
    }
    clean_text = text.replace('\n', ' ')
    for sw, en in sw_months.items():
        clean_text = clean_text.replace(sw, en)
        
    patterns = [
        r'(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})',
        r'(\d{1,2})([a-zA-Z]+),?(\d{4})',
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

def update_dataset(new_records):
    if not new_records:
        return
    
    new_df = pd.DataFrame(new_records)
    # Average DSM markets
    new_df = new_df.groupby(['date', 'commodity']).agg({
        'price': 'mean',
        'unit': 'first',
        'region': 'first'
    }).reset_index()

    if os.path.exists(CSV_PATH):
        old_df = pd.read_csv(CSV_PATH)
        combined = pd.concat([old_df, new_df]).drop_duplicates(subset=['date', 'commodity'], keep='last')
        combined.to_csv(CSV_PATH, index=False)
    else:
        new_df.to_csv(CSV_PATH, index=False)
    
    print(f"✅ Dataset updated with {len(new_df)} new averaged records.")

def run_daily_update():
    print(f"[{datetime.now()}] Checking for new MIT price reports...")
    
    try:
        response = requests.get(BASE_URL, verify=False, timeout=15)
        soup = BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"Error accessing MIT site: {e}")
        return

    # Find the very first (latest) publication link
    latest_link_tag = None
    for a in soup.find_all('a', href=True):
        text = a.get_text().strip()
        href = a['href']
        if ("Bei ya" in text or "Wholesale Price" in text) and href.endswith(".pdf"):
            latest_link_tag = (text, href)
            break # We only need the top one
    
    if not latest_link_tag:
        print("No reports found on the first page.")
        return

    text, href = latest_link_tag
    pub_date = parse_date_from_text(text)
    
    if not pub_date:
        print(f"Could not determine date for: {text}")
        pub_date = datetime.now()

    date_str = pub_date.strftime("%Y%m%d")
    filename = f"{date_str}_daily_report.pdf"
    filepath = os.path.join(DOWNLOAD_DIR, filename)

    if os.path.exists(filepath):
        print(f"Latest report ({pub_date.strftime('%Y-%m-%d')}) already exists. Skipping.")
        return

    print(f"New report found! Downloading: {text}...")
    if not href.startswith("http"):
        href = "https://www.viwanda.go.tz" + href

    try:
        pdf_res = requests.get(href, verify=False, timeout=20)
        with open(filepath, "wb") as f:
            f.write(pdf_res.content)
        
        print("Parsing new data...")
        new_data = parse_price_pdf(filepath, pub_date)
        
        if new_data:
            update_dataset(new_data)
            print("Triggering ML model retraining...")
            subprocess.run(["python", "scripts/train_model.py"], check=True)
            print("✅ All systems updated successfully.")
        else:
            print("⚠️ No DSM data found in the new report.")
            
    except Exception as e:
        print(f"❌ Failed to process update: {e}")

if __name__ == "__main__":
    run_daily_update()
