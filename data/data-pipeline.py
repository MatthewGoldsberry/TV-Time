from bs4 import BeautifulSoup
import requests as req
import csv
import re
import string
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer
# becuase for some reason these don't download alongside nltk...
nltk.download('punkt_tab')
nltk.download('stopwords')

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

# List of films to process
films = ['fotr', 'ttt', 'rotk']
all_dialogues = []

# Text cleaning, normalization, and stemming - we might have to experiment with this later, I feel like this might be too much cleaning
def clean_and_stem(text):
    text = text.lower()
    text = text.translate(str.maketrans('', '', string.punctuation))
    text = re.sub(r'\s+', ' ', text).strip()
    tokens = word_tokenize(text)
    stop_words = set(stopwords.words('english'))
    tokens = [w for w in tokens if w not in stop_words]
    stemmer = PorterStemmer()
    stemmed = [stemmer.stem(w) for w in tokens]
    return ' '.join(stemmed)

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
                    # Skip if speaker contains any brackets or parentheses (stage directions)
                    if re.search(r'[\[(]', speaker_raw):
                        continue
                    speaker = re.sub(r'\s*\([^)]*\)', '', speaker_raw)
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
                    entry['dialogue_cleaned'] = clean_and_stem(entry['dialogue'])
                    all_dialogues.append(entry)
            else:
                # For all other scenes, skip the first entry (title)
                for entry in dialogue_entries[1:]:
                    entry['dialogue_cleaned'] = clean_and_stem(entry['dialogue'])
                    all_dialogues.append(entry)
        else:
            print(f"Error fetching {url}")

# Write to CSV

with open('lotr_dialogues.csv', 'w', newline='', encoding='utf-8') as csvfile:
    fieldnames = ['scene_name', 'character', 'dialogue', 'dialogue_cleaned']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(all_dialogues)

print(f"Extracted {len(all_dialogues)} dialogue entries and saved to lotr_dialogues.csv")