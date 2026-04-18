const fs = require('fs');
let html = fs.readFileSync('c:/Remembory/remembory/manual.html', 'utf8');

// 1. Remove "What's new" panel
html = html.replace(
  /    <div class="callout"[^]*?<\/ul>\s*<\/div>\s*(?=\s*<div class="subtitle">)/s,
  ''
);

// 2. Replace the intro paragraph and Getting Started section
const oldIntro = `<p class="chapter-intro">Chronicle is a personal life journal that lives entirely on your computer as a single HTML file. Open it in any web browser and your memories are stored locally \\u2014 nothing leaves your device unless you choose to share.</p>

      <p>This manual covers every feature in Chronicle. Whether you are just getting started or looking to make the most of a specific capability, you will find step-by-step instructions throughout.</p>

      <h2 id="getting-started">Getting Started</h2>
      <ol class="steps">
        <li>Visit <a href="https://adadx4.github.io/remembory/chronicle.html" style="color:var(--gold-dark)">Chronicle on Remembory</a> in your browser</li>
        <li>Chronicle opens and you are ready to record your first memory</li>
        <li>Bookmark the page for quick access \\u2014 your memories will always be there when you return</li>
      </ol>

      <div class="tip">Chronicle works offline after your first visit. A service worker caches everything so you can use it anywhere, even without an internet connection. Updates happen silently in the background \\u2014 you always have the latest version without doing anything.</div>
      <div class="note">Your memories are stored in your browser on your device \\u2014 they never leave it. If you use multiple browsers (e.g. Chrome and Safari), your memories will be separate in each. Pick one browser and stick to it, or use the backup feature to keep them in sync.</div>`;

const newIntro = `<p class="chapter-intro">Chronicle is a personal life journal that runs in your web browser. Your memories are stored locally on your device and encrypted when you set a password. A subscription unlocks sharing and cloud sync.</p>

      <p>This manual covers every feature in Chronicle. Whether you are just getting started or looking to make the most of a specific capability, you will find step-by-step instructions throughout.</p>

      <h2 id="getting-started">Getting Started</h2>
      <ol class="steps">
        <li>Visit <a href="https://remembory.net/chronicle.html" style="color:var(--gold-dark)">remembory.net/chronicle.html</a> in your browser</li>
        <li>Chronicle opens and you are ready to record your first memory</li>
        <li>Bookmark the page for quick access</li>
      </ol>

      <div class="tip">Chronicle works offline after your first visit. A service worker caches everything so you can use it anywhere, even without an internet connection. Updates happen silently in the background.</div>

      <h2 id="your-data">Where Your Data Lives</h2>
      <p>Chronicle stores your memories in your browser's local storage. This means:</p>
      <ul>
        <li><strong>Each browser keeps its own data.</strong> Chrome, Safari, Firefox, and Edge each have their own storage. If you use Chrome on your laptop, your memories are only in Chrome on that laptop.</li>
        <li><strong>Each browser profile is separate.</strong> If you use multiple Chrome profiles (e.g. personal and work), each one has its own Chronicle data.</li>
        <li><strong>Pick one browser and stick to it.</strong> Choose the browser you use most and always open Chronicle there.</li>
        <li><strong>Clearing browser data deletes your memories.</strong> Be careful with \\u201cClear browsing data\\u201d settings \\u2014 they can erase your Chronicle. Download a backup regularly.</li>
      </ul>

      <h2 id="protecting-data">Protecting Your Memories</h2>
      <p>Because your data lives in browser storage, it is important to protect it:</p>
      <ul>
        <li><strong>Set a password.</strong> Go to Settings \\u2192 Account and set a Chronicle lock password. This encrypts your data so only you can read it.</li>
        <li><strong>Download regular backups.</strong> Go to Settings \\u2192 Backup &amp; Restore and click Download backup. Save the file to a cloud drive, external disk, or both.</li>
        <li><strong>Use Cloud Sync (subscribers).</strong> Cloud Sync backs up your Chronicle to the cloud, encrypted with a passphrase you choose. You can then pull it onto another device. Go to Settings \\u2192 Backup &amp; Restore \\u2192 Cloud Sync.</li>
      </ul>

      <h2 id="multiple-devices">Using Chronicle on Multiple Devices</h2>
      <p>Chronicle data does not automatically sync between devices. To access your Chronicle on a second device:</p>
      <ol class="steps">
        <li><strong>Cloud Sync (recommended):</strong> Push from your primary device, then pull on the second device using the same licence key and passphrase</li>
        <li><strong>Manual backup:</strong> Download a backup file on one device, then import it on the other via Settings \\u2192 Backup &amp; Restore</li>
      </ol>
      <div class="note">If you edit memories on two devices and then sync, Chronicle will show a conflict resolution dialog where you can choose which version to keep for each changed memory, or merge them together.</div>`;

html = html.replace(oldIntro, newIntro);

// 3. Update the navigation table
const oldNavTable = `          <tr><td>\\u25c9 Life</td><td>Your home view \\u2014 memories as a grid of decade cards showing activity across your whole life</td></tr>
          <tr><td>\\u2261 List</td><td>A scrollable chronological list of all memories with search and tag filtering</td></tr>
          <tr><td>\\u2630 Index</td><td>Browse memories by tag, person, organisation, or location</td></tr>
          <tr><td>\\ud83d\\uddfa Map</td><td>A world map showing where memories took place, with clickable pins</td></tr>
          <tr><td>\\ud83d\\udda8 Print</td><td>Generate a formatted document of your life story to print or save as PDF</td></tr>
          <tr><td>\\u2191 Import</td><td>Bring in new memories from photos or email files</td></tr>`;

const newNavTable = `          <tr><td>\\u25c9 Overview</td><td>Your home view \\u2014 memories as a grid of decade cards showing activity across your whole life</td></tr>
          <tr><td>\\u2261 Life Events</td><td>A scrollable chronological list of all memories with search and tag filtering</td></tr>
          <tr><td>\\ud83d\\udcca Life Timeline</td><td>A graphical chart showing your residence, education, and employment history</td></tr>
          <tr><td>\\ud83d\\udc64 People, \\ud83d\\udccd Places, etc.</td><td>Browse memories by person, place, organisation, relationship, group, or tag</td></tr>
          <tr><td>\\ud83d\\uddbc Photos</td><td>All photos across your memories in a chronological gallery</td></tr>
          <tr><td>\\ud83d\\uddfa Map</td><td>A world map showing where memories took place, with filters by tag, person, and decade</td></tr>`;

html = html.replace(oldNavTable, newNavTable);

// 4. Update the Index View section
const oldIndex = `      <h1 id="index-view">The Index View</h1>
      <p class="chapter-intro">The Index view lets you browse memories by category rather than by time. Access it from the navigation \\u2014 it has four tabs.</p>

      <h2>Tags Tab</h2>
      <p>Shows all tags used across your memories, with a count of how many memories carry each tag. Click any tag to see all matching memories displayed as cards.</p>

      <h2>People Tab</h2>
      <p>Shows everyone in your index with a count of memories. People with no memories yet are sorted to the top. Use the filter chips to narrow by relationship, linked organisation, or linked location. Click <strong>+ add person</strong> to record someone before writing any memories about them.</p>

      <h2>Organisations Tab</h2>
      <p>The same as the People tab, but for organisations. Use <strong>+ add org</strong> to record an organisation independently.</p>

      <h2>Locations Tab</h2>
      <p>Shows all locations in your index. Locations without coordinates show a \\u26a0\\ufe0f indicator \\u2014 they won\\u2019t appear on the map until coordinates are set. Click <strong>\\u26a0 Set coords</strong> to enter them manually. Use <strong>+ add location</strong> to record a place before writing any memories about it.</p>`;

const newIndex = `      <h1 id="index-view">Browsing by Category</h1>
      <p class="chapter-intro">The Life menu gives you direct access to browse memories by category. Each category has its own view, accessible from the Life dropdown.</p>

      <h2>People</h2>
      <p>Shows everyone in your Chronicle with a count of memories. People with no memories yet are sorted to the top. You can add relationships, email addresses, notes, and link people to organisations and locations. Click any person to see all their memories. Use <strong>+ add person</strong> to record someone before writing any memories about them.</p>

      <h2>Places</h2>
      <p>Shows all locations in your Chronicle. Add address details (town, state, country) to improve map accuracy. Locations without coordinates won\\u2019t appear on the map \\u2014 click <strong>Set coords</strong> to enter them manually, or add address fields and let the map geocode them automatically.</p>

      <h2>Organisations</h2>
      <p>Shows all organisations. Link them to locations and time periods. Use <strong>+ add org</strong> to record an organisation before writing memories about it.</p>

      <h2>Groups</h2>
      <p>Create named groups of people \\u2014 family, school friends, work colleagues. When adding a memory, a pill button for each group appears above the People field. One tap adds everyone in the group.</p>

      <h2>Relationships</h2>
      <p>Groups people by their relationship type \\u2014 family, friend, colleague, and so on. Click any relationship to see all the people in it and their memories.</p>

      <h2>Tags</h2>
      <p>Shows all tags used across your memories with counts. Click any tag to see all matching memories. Tags like <em>home</em>, <em>education</em>, and <em>employment</em> also feed the Life Timeline chart.</p>

      <h2>Photos</h2>
      <p>A chronological gallery of all photos across your memories. Click any photo to open the memory it belongs to.</p>`;

html = html.replace(oldIndex, newIndex);

// 5. Update the Adding a Memory intro
const oldAdding = `      <h1 id="adding">Adding a Memory</h1>
      <p class="chapter-intro">Click the <strong>+ Add</strong> button in the header to open the memory form. Only the title is required \\u2014 fill in everything else at whatever level of detail feels right.</p>`;

const newAdding = `      <h1 id="adding">Adding Memories</h1>
      <p class="chapter-intro">There are several ways to get memories into Chronicle:</p>
      <ul>
        <li><strong>From Memory</strong> \\u2014 Write a memory directly using the Add menu. Only a title and date are required.</li>
        <li><strong>From Photo</strong> \\u2014 Import photos and Chronicle reads the date (and GPS location if available) from the image metadata automatically.</li>
        <li><strong>Get Prompt</strong> \\u2014 Chronicle\\u2019s Prompter asks questions based on the people, places, and themes already in your Chronicle, helping you recall memories you might not have thought to record.</li>
        <li><strong>Build the index first</strong> \\u2014 Add people, places, and organisations via the Life menu before writing memories. The Prompter uses these to generate targeted questions, and they appear as suggestions when you fill in the memory form.</li>
      </ul>
      <p>To add a memory directly, go to <strong>Add \\u2192 From Memory</strong>. Only the title and date are required \\u2014 fill in everything else at whatever level of detail feels right. Optional fields (location, tags, people, organisations, photos) open one at a time to keep the form clean.</p>`;

html = html.replace(oldAdding, newAdding);

// 6. Update the List View heading
html = html.replace(
  '<h1 id="list-view">The List View</h1>',
  '<h1 id="list-view">Life Events</h1>'
);

// 7. Remove the separate People Manager section since it's now part of the index
const oldPeopleManager = `    <!-- People Manager -->
    <section class="section">
      <h2>Relationships Tab</h2>
      <p>Groups people by their relationship type \\u2014 family, friend, colleague, and so on. Click any relationship to see all the people in it.</p>

      <h2>Groups Tab</h2>
      <p>Shows named groups of people. See <a href="#groups">Groups</a> below for full details.</p>
    </section>`;

html = html.replace(oldPeopleManager, '');

fs.writeFileSync('c:/Remembory/remembory/manual.html', html, 'utf8');
console.log('Manual patched successfully');
