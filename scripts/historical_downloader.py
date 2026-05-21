import requests
from bs4 import BeautifulSoup
import os
import time
from datetime import datetime
import re

BASE_URL = "https://www.viwanda.go.tz/documents/product-prices-domestic"
DOWNLOAD_DIR = "data/raw_pdfs"
# May 20, 2026 -> 3 years back is May 2023
START_DATE_LIMIT = datetime(2023, 5, 20)

def get_actual_pdf_link(pub_url):
    try:
        response = requests.get(pub_url, verify=False, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        # Look for the download button/link
        for a in soup.find_all('a', href=True):
            if "download" in a['href'].lower() or "attachment" in a['href'].lower():
                link = a['href']
                if not link.startswith("http"):
                    link = "https://www.viwanda.go.tz" + link
                return link
    except Exception as e:
        print(f"Error finding PDF link in {pub_url}: {e}")
    return None

def parse_date_from_text(text):
    # Matches "06 May, 2026", "27 April 2026", "04 Mei 2026", "27Machi,2026"
    sw_months = {
        "Januari": "January", "Februari": "February", "Machi": "March", 
        "Aprili": "April", "Mei": "May", "Juni": "June", 
        "Julai": "July", "Agosti": "August", "Septemba": "September", 
        "Oktoba": "October", "Novemba": "November", "Desemba": "December",
        "Octoba": "October", "Sepetemba": "September" # Variations
    }
    
    clean_text = text.replace('\n', ' ')
    for sw, en in sw_months.items():
        clean_text = clean_text.replace(sw, en)
        
    # Try multiple regex patterns
    patterns = [
        r'(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})', # 06 May 2026
        r'(\d{1,2})([a-zA-Z]+),?(\d{4})',        # 27Machi2026
        r'(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})',    # 06 May 2026
    ]
    
    for pattern in patterns:
        match = re.search(pattern, clean_text)
        if match:
            d, m, y = match.groups()
            try:
                # If m is like "Mei" or "Machi" it should be replaced by English already
                return datetime.strptime(f"{d} {m} {y}", "%d %B %Y")
            except:
                continue
    return None

def download_historical():
    if not os.path.exists(DOWNLOAD_DIR):
        os.makedirs(DOWNLOAD_DIR)
        
    page = 1
    total_downloaded = 0
    reached_limit = False
    
    while not reached_limit:
        print(f"\n--- Scanning Page {page} ---")
        url = f"{BASE_URL}?page={page}"
        try:
            response = requests.get(url, verify=False, timeout=15)
            soup = BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            print(f"Error accessing page {page}: {e}")
            break
            
        links_found = 0
        for a in soup.find_all('a', href=True):
            text = a.get_text().strip()
            href = a['href']
            
            # Match "Bei ya" or "Wholesale Price" and link ending in .pdf
            if ("Bei ya" in text or "Wholesale Price" in text or "mazao" in text) and href.endswith(".pdf"):
                links_found += 1
                pub_date = parse_date_from_text(text)
                
                if pub_date and pub_date < START_DATE_LIMIT:
                    print(f"Reached date limit: {pub_date.strftime('%Y-%m-%d')}. Stopping.")
                    reached_limit = True
                    break
                
                if not href.startswith("http"):
                    href = "https://www.viwanda.go.tz" + href
                
                # Create a safe filename
                safe_name = re.sub(r'[^\w\s-]', '', text).replace(' ', '_').split('\n')[0].strip()
                filename = f"{pub_date.strftime('%Y%m%d') if pub_date else 'unknown'}_{safe_name}.pdf"
                filepath = os.path.join(DOWNLOAD_DIR, filename)
                
                if os.path.exists(filepath):
                    # print(f"Skipping (already exists): {filename}")
                    continue
                
                print(f"Downloading: {text.split('\\n')[0].strip()}...")
                try:
                    pdf_res = requests.get(href, verify=False, timeout=20)
                    with open(filepath, "wb") as f:
                        f.write(pdf_res.content)
                    print(f"Saved to {filepath}")
                    total_downloaded += 1
                    time.sleep(0.5) # Be polite
                except Exception as e:
                    print(f"Failed to download PDF from {href}: {e}")
        
        if links_found == 0:
            print("No publication links found on this page.")
            break
            
        if reached_limit:
            break
            
        page += 1
        # Safety break for demo/testing - in reality, remove or increase this
        if page > 50: 
            break

    print(f"\n✅ Finished! Total downloaded: {total_downloaded} PDFs.")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    download_historical()
