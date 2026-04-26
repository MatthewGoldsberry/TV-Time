from bs4 import BeautifulSoup
import requests as req
import csv
import unicodedata
import re
import string
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
import os
from nltk.stem import WordNetLemmatizer
# becuase for some reason these don't download alongside nltk...
nltk.download('punkt_tab')
nltk.download('stopwords')
nltk.download('wordnet')

# scrape the main page to get scene names
main_page = req.get("https://www.tk421.net/lotr/film/")
scene_names = {}

if main_page:
    soup = BeautifulSoup(main_page.content, 'html.parser')

    # Find all scene links
    for li in soup.find_all('li'):
        a = li.find('a')
        if a and 'href' in a.attrs:
            href = a['href']
            title = a.get_text(strip=True)
            if href.startswith(('fotr/', 'ttt/', 'rotk/')):
                film = href.split('/')[0]
                scene_num = href.split('/')[1].split('.')[0]
                if film not in scene_names:
                    scene_names[film] = {}
                scene_names[film][scene_num] = title

FILM_NAMES = {
    'fotr': 'The Fellowship of the Ring',
    'ttt':  'The Two Towers',
    'rotk': 'The Return of the King',
}

# List of films to process
films = ['fotr', 'ttt', 'rotk']
all_dialogues = []

def normalize_unicode(text):
    # Replace Unicode ellipsis and dashes with ASCII equivalents
    text = text.replace('\u2026', '...')  # ellipsis
    text = text.replace('…', '...')
    text = text.replace('\u2014', '-')    # em dash
    text = text.replace('—', '-')
    text = text.replace('\u2013', '-')    # en dash
    text = text.replace('–', '-')
    # Normalize other unicode characters to closest ASCII
    text = unicodedata.normalize('NFKC', text)
    return text

# Text cleaning and lemmatization for word-frequency analysis
def clean_text(text):
    text = normalize_unicode(text)
    text = text.lower()
    # Punctuation removal joins hyphenated compounds ("pipe-weed" → "pipeweed")
    text = text.translate(str.maketrans('', '', string.punctuation))
    text = re.sub(r'\s+', ' ', text).strip()
    tokens = word_tokenize(text)
    stop_words = set(stopwords.words('english'))
    # isalpha() drops digits/fragments; non-English words (Elvish etc.) pass through unchanged
    tokens = [w for w in tokens if w.isalpha() and w not in stop_words]
    lemmatizer = WordNetLemmatizer()
    return ' '.join(lemmatizer.lemmatize(w) for w in tokens)

for film in films:
    print(f"Processing {film}...")

    for i in range(1, 33): # Each film has exactly 32 scenes worth of diaglogue
        scene_num = f"{i:02d}" if i < 10 else str(i)

        # Get scene name from our scraped data
        scene_name = scene_names.get(film, {}).get(scene_num, f"Scene {i}")

        print(f"Processing {film} scene {i}: {scene_name}")

        # Construct URL
        url = f"https://www.tk421.net/lotr/film/{film}/{scene_num}.html"
        html_doc = req.get(url)

        if html_doc and html_doc.status_code == 200:
            soup = BeautifulSoup(html_doc.content, 'html.parser')

            # Extract speaker names and dialogue lines
            dialogue_entries = []
            # Directly add Galadriel prologue for Fellowship scene 1, it is weirdly laid out as a block quote and breaks the speaker: dialogue pattern
            if film == 'fotr' and i == 1:
                dialogue_entries.append({
                    'scene_name': scene_name,
                    'character': 'Galadriel',
                    'film': FILM_NAMES[film],
                    'dialogue': (
                        'I amar prestar aen… The world is changed. Han mathon ne nen… I feel it in the water. Han mathon ne chae… I feel it in the Earth. A han noston ned gwilith… I smell it in the air.'
                    )
                })
            for element in soup.find_all(['p', 'div', 'span']):
                text = element.get_text(strip=True)

                # Check if text contains a colon (speaker: dialogue pattern)
                if ':' in text:
                    # Split on first colon to separate speaker from dialogue
                    parts = text.split(':', 1)

                    # Remove all parenthetical elements from the speaker name (these are stage directions or descriptions)
                    speaker_raw = parts[0]
                    # Skip if speaker contains any brackets (stage directions)
                    if re.search(r'\[', speaker_raw):
                        continue
                    # Remove all parenthetical elements (parentheses) from the speaker name
                    speaker = re.sub(r'\s*\([^)]*\)', '', speaker_raw)
                    # Remove all bracketed elements from the speaker name (but only after skipping lines with brackets)
                    speaker = re.sub(r'\s*\[[^\]]*\]', '', speaker).strip()

                    # Remove all bracketed elements from the dialogue
                    dialogue = parts[1].strip() if len(parts) > 1 else ""
                    dialogue = re.sub(r'\s*\[[^\]]*\]', '', dialogue).strip()
                    # Remove all quotation marks from the dialogue
                    dialogue = dialogue.replace('"', '')

                    # Only add if both speaker and dialogue exist
                    if speaker and dialogue:
                        dialogue_entries.append({
                            'scene_name': scene_name,
                            'character': speaker,
                            'film': FILM_NAMES[film],
                            'dialogue': dialogue
                        })
            # For Fellowship scene 1, keep prologue and skip the next entry (title)
            if film == 'fotr' and i == 1:
                # If there are at least 2 entries, skip the second (title)
                entries_to_add = [dialogue_entries[0]]
                if len(dialogue_entries) > 2:
                    entries_to_add += dialogue_entries[2:]
                elif len(dialogue_entries) == 2:
                    pass  # Only prologue and title, just keep prologue
                for entry in entries_to_add:
                    entry['dialogue_cleaned'] = clean_text(entry['dialogue'])
                    all_dialogues.append(entry)
            else:
                # For all other scenes, skip the first entry (title)
                for entry in dialogue_entries[1:]:
                    entry['dialogue_cleaned'] = clean_text(entry['dialogue'])
                    all_dialogues.append(entry)
        else:
            print(f"Error fetching {url}")

# Preserve location field if it exists in the current CSV
existing_locations = {}
csv_path = os.path.join(os.path.dirname(__file__), 'lotr_script_data.csv')
if os.path.exists(csv_path):
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Use a tuple of identifying fields as the key
            key = (row['scene_name'], row['character'], normalize_unicode(row['dialogue']))
            existing_locations[key] = row.get('location', '')

# Write to CSV, preserving location if present
fieldnames = ['film', 'scene_name', 'character', 'dialogue', 'dialogue_cleaned', 'location']
with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    for entry in all_dialogues:
        # Normalize dialogue for matching
        key = (entry['scene_name'], entry['character'], normalize_unicode(entry['dialogue']))
        location = existing_locations.get(key, '')
        row = {
            'film': entry['film'],
            'scene_name': entry['scene_name'],
            'character': entry['character'],
            'dialogue': normalize_unicode(entry['dialogue']),
            'dialogue_cleaned': entry['dialogue_cleaned'],
            'location': location
        }
        writer.writerow(row)

print(f"Extracted {len(all_dialogues)} dialogue entries and saved to data.csv (location field preserved)")