// This object will store all the user's choices, acting as our digital character sheet.
let character = {
    name: "Unnamed Hero",
    thresholdBonus: 0,
    domainCards: [],
    loadout: [null, null, null, null, null], // Active cards in specific slots
    level: 1,
    equipment: {},
    advancementsTaken: {}, // Permanent, cumulative tracker for all advancements
    advancementsTakenThisTier: {}, // Resets each tier for display purposes
    traitBoostsByTier: { tier2: [], tier3: [], tier4: [] }, // Tracks trait boosts per tier
    multiclass: null,
    multiclassDomain: null,
    multiclassFoundationFeature: null,
    class_feature_multiclass: null,
    multiclassSpecializationFeature: null
};
let characterHistory = []; // Stores previous versions of the character object for reverting levels
const gameData = {};
let tempGeneratedCharacter = null; // Holds the character from the generator until finalized

// This object will manage the state of the level-up wizard
let levelUpState = {};

document.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetch('data/classes.json').then(response => response.json()),
        fetch('data/ancestries.json').then(response => response.json()),
        fetch('data/communities.json').then(response => response.json()),
        fetch('data/domain_cards.json').then(response => response.json()),
        fetch('data/weapons.json').then(response => response.json()),
        fetch('data/armor.json').then(response => response.json()),
        fetch('data/advancements.json').then(response => response.json()),
        fetch('data/experiences.json').then(response => response.json())
    ])
    .then(([classes, ancestries, communities, domainCards, weapons, armor, advancements, experiences]) => {
        gameData.classes = classes;
        gameData.ancestries = ancestries;
        gameData.communities = communities;
        gameData.domainCards = domainCards;
        gameData.weapons = weapons;
        gameData.armor = armor;
        gameData.advancements = advancements;
        gameData.experiences = experiences;
        displayClassSelection();
    })
    .catch(error => console.error('Error loading game data:', error));
});


// --- LOCAL STORAGE SAVE & LOAD FUNCTIONS ---

function saveCharacter() {
    let characterNameToSave = character.name;

    // If the character has a default name, prompt the user to enter a new one.
    if (characterNameToSave === "Unnamed Hero" || characterNameToSave === "Test Hero") {
        const newName = prompt("Please enter a name for your character before saving:", "");
        if (!newName || newName.trim() === "") {
            alert("Save cancelled. A name is required to save a character.");
            return; // Abort if the user cancels or enters an empty name
        }
        character.name = newName.trim();
        characterNameToSave = character.name;
    }

    let savedCharacters = JSON.parse(localStorage.getItem('daggerheartCharacters')) || {};
    
    // Check if a character with the new name already exists and ask for confirmation to overwrite.
    if (savedCharacters[characterNameToSave]) {
        if (!confirm(`A character named ${characterNameToSave} already exists. Do you want to overwrite it?`)) {
            return; // Abort saving if the user cancels
        }
    }

    savedCharacters[characterNameToSave] = character;
    localStorage.setItem('daggerheartCharacters', JSON.stringify(savedCharacters));
    alert(`${characterNameToSave} has been saved!`);
    
    // Refresh the character sheet to show the new name if it was changed
    displayCharacterSheet();
}


function loadCharacter(characterName) {
    let savedCharacters = JSON.parse(localStorage.getItem('daggerheartCharacters')) || {};
    if (savedCharacters[characterName]) {
        character = savedCharacters[characterName];
        closeLoadCharacterModal(); // Automatically close the modal
        displayCharacterSheet();
    } else {
        alert("Could not find character to load.");
    }
}

function deleteCharacter(characterName) {
    if (!confirm(`Are you sure you want to delete ${characterName}? This cannot be undone.`)) {
        return;
    }
    let savedCharacters = JSON.parse(localStorage.getItem('daggerheartCharacters')) || {};
    delete savedCharacters[characterName];
    localStorage.setItem('daggerheartCharacters', JSON.stringify(savedCharacters));
    closeLoadCharacterModal(); // Close the modal
    displayClassSelection(); // Refresh the main screen
}

function openLoadCharacterModal() {
    const savedCharacters = JSON.parse(localStorage.getItem('daggerheartCharacters')) || {};
    const characterNames = Object.keys(savedCharacters);

    let modalHTML = `
        <div class="modal-overlay" id="load-character-modal-overlay">
            <div class="modal-content">
                <button class="modal-close-btn" onclick="closeLoadCharacterModal()">&times;</button>
                <h2>Load Character</h2>
    `;

    if (characterNames.length > 0) {
        modalHTML += '<div id="saved-character-list">';
        characterNames.forEach(name => {
            const char = savedCharacters[name];
            modalHTML += `
                <div class="saved-character-item">
                    <span>${name} - Lvl ${char.level} ${char.ancestry.name} ${char.class.name}</span>
                    <div class="buttons">
                        <button class="action-button" style="margin:0; padding: 8px 15px;" onclick="loadCharacter('${name}')">Load</button>
                        <button class="back-btn" style="padding: 8px 15px;" onclick="deleteCharacter('${name}')">Delete</button>
                    </div>
                </div>
            `;
        });
        modalHTML += '</div>';
    } else {
        modalHTML += `<p>You have no saved characters.</p>`;
    }

    modalHTML += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeLoadCharacterModal() {
    const modal = document.getElementById('load-character-modal-overlay');
    if (modal) {
        modal.remove();
    }
}


// --- UTILITY & HELPER FUNCTIONS ---

function formatDescription(text) {
    if (!text) return '';
    if (!text.includes('\n*')) return `<p>${text}</p>`;
    let html = '';
    const parts = text.split('\n*');
    const mainDesc = parts[0].trim();
    if (mainDesc) html += `<p>${mainDesc}</p>`;
    const subAbilities = parts.slice(1);
    html += '<ul class="feature-list">';
    subAbilities.forEach(abilityText => { html += `<li>${abilityText.trim()}</li>`; });
    html += '</ul>';
    return html;
}

function getCreatorContainer() {
    const creatorContainer = document.getElementById('character-creator');
    creatorContainer.innerHTML = '';
    document.getElementById('character-sheet-container').innerHTML = '';
    document.getElementById('character-sheet-container').classList.add('hidden');
    creatorContainer.classList.remove('hidden');
    return creatorContainer;
}

function getTierKey(lvl) {
    if (lvl >= 8) return 'tier4';
    if (lvl >= 5) return 'tier3';
    if (lvl >= 2) return 'tier2';
    return 'tier1';
}

function getCharacterTier(level) {
    if (level >= 8) return 4;
    if (level >= 5) return 3;
    if (level >= 2) return 2;
    return 1;
}

function getBaseProficiency(level) {
    if (level >= 8) return 4;
    if (level >= 5) return 3;
    if (level >= 2) return 2;
    return 1;
}

// --- VAULT MODAL FUNCTIONS ---
function openVaultModal(isSwap = false, cardToSwap = null, index = -1) {
    const vaultCards = character.domainCards.filter(card => !character.loadout.includes(card.name));
    const title = isSwap ? `Swap for ${cardToSwap}` : (index !== -1 ? 'Add Card to Loadout' : `Domain Card Vault`);

    let modalHTML = `
        <div class="modal-overlay" id="vault-modal-overlay">
            <div class="modal-content">
                <button class="modal-close-btn" onclick="closeVaultModal()">&times;</button>
                <h2>${title}</h2>
    `;

    if (vaultCards.length > 0) {
        modalHTML += vaultCards.map(card => {
            // BUG FIX: Escape apostrophes in card names for the onclick attribute
            const escapedCardName = card.name.replace(/'/g, "\\'");
            let buttonAction, buttonText;
            if (isSwap) {
                buttonAction = `finalizeSwap('${escapedCardName}', ${index})`;
                buttonText = 'Select';
            } else if (index !== -1) { // Adding to a specific empty slot
                buttonAction = `addCardToLoadoutAtIndex('${escapedCardName}', ${index})`;
                buttonText = 'Add to Slot';
            } else { // Generic "move to loadout"
                buttonAction = `moveDomainCard('${escapedCardName}', 'toLoadout')`;
                buttonText = '↑ To Loadout';
            }

            return `
                <div class="vault-card-item">
                    <div class="vault-card-header" onclick="this.nextElementSibling.classList.toggle('open')">
                        <h4>${card.name}</h4>
                        <button class="move-btn" onclick="${buttonAction}">${buttonText}</button>
                    </div>
                    <div class="vault-card-details">
                        ${processFeatureText(card.description)}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        modalHTML += `<p>Your vault is empty.</p>`;
    }

    modalHTML += `</div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeVaultModal() {
    const modal = document.getElementById('vault-modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// --- DOMAIN CARD MANAGEMENT ---
function moveDomainCard(index) {
    character.loadout[index] = null;
    displayCharacterSheet();
}

function swapDomainCard(index) {
    const cardToSwap = character.loadout[index];
    if (cardToSwap) {
        openVaultModal(true, cardToSwap, index);
    }
}

function finalizeSwap(cardToAdd, index) {
    if (index >= 0 && index < 5) {
        character.loadout[index] = cardToAdd;
    }
    closeVaultModal();
    displayCharacterSheet();
}

function addToEmptySlot(index) {
    openVaultModal(false, null, index);
}

function addCardToLoadoutAtIndex(cardName, index) {
    if (index >= 0 && index < 5 && !character.loadout.includes(cardName)) {
        character.loadout[index] = cardName;
    }
    closeVaultModal();
    displayCharacterSheet();
}


// --- CHARACTER CREATION FLOW ---

function displayClassSelection() {
    characterHistory = [];
    tempGeneratedCharacter = null;
    const creatorContainer = getCreatorContainer();
    const classSelectionStep = document.createElement('div');
    classSelectionStep.id = 'class-selection';
    
    const hasSavedCharacters = Object.keys(JSON.parse(localStorage.getItem('daggerheartCharacters')) || {}).length > 0;

    let fullHTML = `
        <div class="attribution-block">
            <h1>Daggerheart Character Creator and Generator</h1>
            <p>by Ettin Entertainment</p>
            <p class="legal-text">
                Darrington Press™ and the Darrington Press authorized work logo are trademarks of Critical Role, LLC and used with permission. This product includes materials from the Daggerheart System Reference Document 1.0, © 2024 Critical Role, LLC. under the terms of the Darrington Press Community Gaming (DPCGL) License. More information can be found at https://www.daggerheart.com. There are no previous modifications by others.
            </p>
        </div>

        <h2>Manual Creation: Choose Your Class</h2>
        <div id="manual-class-cards" class="cards-container"></div>
        
        <div style="text-align: center; margin: 30px 0;">
            <button class="action-button" onclick="openLoadCharacterModal()" ${!hasSavedCharacters ? 'disabled' : ''}>Load Character</button>
        </div>

        <hr style="margin: 40px 0; border-color: #444;">

        <div id="generator-ui" class="card" style="max-width: 400px; margin: 20px auto; padding: 20px; cursor: default;">
            <h3>Random Generator</h3>
            <p>Generate a random character at a specific level.</p>
            <div class="generator-controls">
                <div>
                    <label for="generator-level-select">Level:</label>
                    <select id="generator-level-select">
                        ${[1,2,3,4,5,6,7,8,9,10].map(lvl => `<option value="${lvl}">${lvl}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="generator-class-select">Class:</label>
                    <select id="generator-class-select">
                        <option value="any">Any Class</option>
                        ${gameData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <button id="generate-preview-btn" class="action-button">Generate</button>
            </div>
            <div id="generator-preview-area" style="border-top: 1px solid #444; padding-top: 15px; margin-top: 15px; min-height: 150px;"></div>
        </div>
    `;

    classSelectionStep.innerHTML = fullHTML;
    creatorContainer.appendChild(classSelectionStep);

    const cardsContainer = document.getElementById('manual-class-cards');
    gameData.classes.forEach(classData => {
        const card = document.createElement('div');
        card.className = 'card';
        card.addEventListener('click', () => selectClass(classData));
        card.innerHTML = `<h3>${classData.name}</h3>${formatDescription(classData.description)}`;
        cardsContainer.appendChild(card);
    });

    document.getElementById('generate-preview-btn').addEventListener('click', () => {
        const level = parseInt(document.getElementById('generator-level-select').value, 10);
        const className = document.getElementById('generator-class-select').value;
        generateTestCharacter(level, true, className);
    });
}


function selectClass(classData) { 
    character.class = classData; 
    // Store original domains in case user backs out of new step
    character.originalDomains = [...classData.domains];
    displayDomainSetSelection(); 
}

function displaySubclassSelection() {
    const creatorContainer = getCreatorContainer();
    const subclassSelectionStep = document.createElement('div');
    subclassSelectionStep.id = 'subclass-selection';
    subclassSelectionStep.innerHTML = `<h2>Step 2: Choose Your Subclass for ${character.class.name}</h2>`;
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back to Class';
    backButton.addEventListener('click', () => { 
        delete character.subclass; 
        character.class.domains = [...character.originalDomains]; // Restore original domains
        displayDomainSetSelection(); 
    });
    navContainer.appendChild(backButton);
    subclassSelectionStep.appendChild(navContainer);
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    character.class.subclasses.forEach(subclassData => {
        const card = document.createElement('div');
        card.className = 'card';
        card.addEventListener('click', () => selectSubclass(subclassData));
        let cardContent = `<h3>${subclassData.name}</h3>${formatDescription(subclassData.description)}`;
        cardContent += `<hr><h4>Foundation Feature: ${subclassData.foundation_feature.name}</h4>`;
        cardContent += formatDescription(subclassData.foundation_feature.description);
        card.innerHTML = cardContent;
        cardsContainer.appendChild(card);
    });
    subclassSelectionStep.appendChild(cardsContainer);
    creatorContainer.appendChild(subclassSelectionStep);
}

function selectSubclass(subclassData) { character.subclass = subclassData; displayAncestrySelection(); }

function displayDomainSetSelection() {
    const creatorContainer = getCreatorContainer();
    const domainSetSelectionStep = document.createElement('div');
    domainSetSelectionStep.id = 'domain-set-selection';
    
    const allDomains = [...new Set(gameData.domainCards.map(card => card.domain))].sort();
    const originalDomains = character.class.domains;

    let domainCardsHTML = allDomains.map(domain => {
        const isSelected = originalDomains.includes(domain);
        return `
            <div class="card ${isSelected ? 'selected' : ''}" data-domain-name="${domain}">
                <h3>${domain}</h3>
            </div>
        `;
    }).join('');

    domainSetSelectionStep.innerHTML = `
        <h2>Step 2: Choose Domain Set for ${character.class.name}</h2>
        <div class="step-nav">
            <button class="back-btn" id="domain-set-back-btn">← Back to Class</button>
            <button class="action-button" id="domain-set-next-btn" style="margin-left: auto;">Confirm Domains →</button>
        </div>
        <p>Your class's default domains are <strong>${originalDomains.join(' & ')}</strong>. You can keep these, or select any two domains to test.</p>
        <p>Selected: <span id="selected-domain-count">${originalDomains.length}</span> / 2</p>
        <div class="cards-container" id="domain-set-cards">${domainCardsHTML}</div>
    `;

    creatorContainer.appendChild(domainSetSelectionStep);

    document.getElementById('domain-set-back-btn').addEventListener('click', () => {
        delete character.class;
        delete character.originalDomains;
        displayClassSelection();
    });

    document.getElementById('domain-set-next-btn').addEventListener('click', () => {
        const selectedDomains = Array.from(document.querySelectorAll('#domain-set-cards .card.selected')).map(c => c.dataset.domainName);
        if (selectedDomains.length === 2) {
            character.class.domains = selectedDomains; // Overwrite the class domains
            displaySubclassSelection();
        } else {
            alert('You must select exactly two domains.');
        }
    });

    document.querySelectorAll('#domain-set-cards .card').forEach(card => {
        card.addEventListener('click', () => {
            const selectedCount = document.querySelectorAll('#domain-set-cards .card.selected').length;
            if (card.classList.contains('selected')) {
                card.classList.remove('selected');
            } else if (selectedCount < 2) {
                card.classList.add('selected');
            }
            
            const newSelectedCount = document.querySelectorAll('#domain-set-cards .card.selected').length;
            document.getElementById('selected-domain-count').textContent = newSelectedCount;
            document.getElementById('domain-set-next-btn').disabled = newSelectedCount !== 2;
        });
    });
}

function displayAncestrySelection() {
    const creatorContainer = getCreatorContainer();
    const ancestrySelectionStep = document.createElement('div');
    ancestrySelectionStep.id = 'ancestry-selection';
    ancestrySelectionStep.innerHTML = '<h2>Step 3: Choose Your Ancestry</h2>';
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back to Subclass';
    backButton.addEventListener('click', () => { delete character.subclass; displaySubclassSelection(); });
    navContainer.appendChild(backButton);
    ancestrySelectionStep.appendChild(navContainer);
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    gameData.ancestries.forEach(ancestryData => {
        const card = document.createElement('div');
        card.className = 'card';
        card.addEventListener('click', () => selectAncestry(ancestryData));
        let cardContent = `<h3>${ancestryData.name}</h3>${formatDescription(ancestryData.description)}<hr>`;
        ancestryData.features.forEach(feature => {
            cardContent += `<h4>${feature.name}</h4>${formatDescription(feature.description)}`;
        });
        card.innerHTML = cardContent;
        cardsContainer.appendChild(card);
    });
    ancestrySelectionStep.appendChild(cardsContainer);
    creatorContainer.appendChild(ancestrySelectionStep);
}

function selectAncestry(ancestryData) { character.ancestry = ancestryData; displayCommunitySelection(); }

function displayCommunitySelection() {
    const creatorContainer = getCreatorContainer();
    const communitySelectionStep = document.createElement('div');
    communitySelectionStep.id = 'community-selection';
    communitySelectionStep.innerHTML = '<h2>Step 4: Choose Your Community</h2>';
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back to Ancestry';
    backButton.addEventListener('click', () => { delete character.ancestry; displayAncestrySelection(); });
    navContainer.appendChild(backButton);
    communitySelectionStep.appendChild(navContainer);
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    gameData.communities.forEach(communityData => {
        const card = document.createElement('div');
        card.className = 'card';
        card.addEventListener('click', () => selectCommunity(communityData));
        card.innerHTML = `<h3>${communityData.name}</h3><p>${communityData.description}</p><hr><h4>${communityData.feature.name}</h4><p>${communityData.feature.description}</p>`;
        cardsContainer.appendChild(card);
    });
    communitySelectionStep.appendChild(cardsContainer);
    creatorContainer.appendChild(communitySelectionStep);
}

function selectCommunity(communityData) { character.community = communityData; displayTraitSelection(); }

function displayTraitSelection() {
    const creatorContainer = getCreatorContainer();
    const traitSelectionStep = document.createElement('div');
    traitSelectionStep.id = 'trait-selection';
    traitSelectionStep.innerHTML = '<h2>Step 5: Assign Your Traits</h2>';
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back to Community';
    backButton.addEventListener('click', () => { delete character.community; displayCommunitySelection(); });
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Selections';
    clearButton.className = 'clear-btn';
    clearButton.addEventListener('click', () => {
        document.querySelectorAll('.trait-selection-box select').forEach(select => { select.value = ''; });
        updateTraitDropdowns();
    });
    const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Confirm Traits →';
    nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', selectTraits);
    navContainer.appendChild(backButton);
    navContainer.appendChild(clearButton);
    navContainer.appendChild(nextButton);
    traitSelectionStep.appendChild(navContainer);

    const traitContainer = document.createElement('div');
    traitContainer.id = 'trait-selection-container';

    if (character.subclass.spellcast_trait) {
        traitContainer.innerHTML += `<p style="text-align: center; font-style: italic; font-size: 1.1em;">Your Spellcast Trait for ${character.subclass.name} is <strong>${character.subclass.spellcast_trait}</strong>.</p>`;
    }

    const suggestedButton = document.createElement('button');
    suggestedButton.textContent = `Use Suggested Traits for ${character.class.name}`;
    suggestedButton.className = 'action-button';
    suggestedButton.style.display = 'block';
    suggestedButton.style.margin = '20px auto';
    suggestedButton.addEventListener('click', () => {
        const suggested = character.class.suggested_traits;
        for (const traitName in suggested) {
            const select = document.getElementById(`trait-${traitName.toLowerCase()}`);
            if (select) {
                const value = suggested[traitName] >= 0 ? `+${suggested[traitName]}` : `${suggested[traitName]}`;
                select.value = value;
            }
        }
        updateTraitDropdowns();
    });
    traitContainer.appendChild(suggestedButton);

    const modifierDisplay = document.createElement('div');
    modifierDisplay.className = 'modifier-display-container';
    modifierDisplay.innerHTML = '<h4>Available Modifiers:</h4><ul class="modifier-list"></ul>';
    traitContainer.appendChild(modifierDisplay);

    const traitGrid = document.createElement('div');
    traitGrid.className = 'trait-selection-grid';
    const traits = [
        { name: 'Strength', description: 'Raw physical power.' },
        { name: 'Agility', description: 'Speed, reflexes, and balance.' },
        { name: 'Finesse', description: 'Precision, stealth, and delicacy.' },
        { name: 'Instinct', description: 'Perception and intuition.' },
        { name: 'Presence', description: 'Charisma and intimidation.' },
        { name: 'Knowledge', description: 'Memory and investigation.' }
    ];
    traits.forEach(trait => {
        const traitItem = document.createElement('div');
        traitItem.className = 'trait-selection-box';
        traitItem.innerHTML = `
            <div class="name">${trait.name}</div>
            <select id="trait-${trait.name.toLowerCase()}" data-trait="${trait.name.toLowerCase()}"></select>
            <p>${trait.description}</p>
        `;
        traitItem.querySelector('select').addEventListener('change', updateTraitDropdowns);
        traitGrid.appendChild(traitItem);
    });
    traitContainer.appendChild(traitGrid);

    const errorMessage = document.createElement('div');
    errorMessage.id = 'trait-error';
    traitContainer.appendChild(errorMessage);
    traitSelectionStep.appendChild(traitContainer);
    creatorContainer.appendChild(traitSelectionStep);
    updateTraitDropdowns();
}

function updateTraitDropdowns() {
    const allModifiers = ['+2', '+1', '+1', '+0', '+0', '-1'];
    const allSelects = document.querySelectorAll('#trait-selection-container select');
    const selectedValues = new Map();
    allSelects.forEach(select => {
        if (select.value) {
            const count = selectedValues.get(select.value) || 0;
            selectedValues.set(select.value, count + 1);
        }
    });
    allSelects.forEach(currentSelect => {
        const currentValue = currentSelect.value;
        let newOptions = '<option value="">--</option>';
        const availableModifiers = [...allModifiers];
        for (const [value, count] of selectedValues.entries()) {
            if (value !== currentValue) {
                for (let i = 0; i < count; i++) {
                    const index = availableModifiers.indexOf(value);
                    if (index > -1) availableModifiers.splice(index, 1);
                }
            }
        }
        availableModifiers.sort((a,b) => parseInt(b) - parseInt(a)).forEach(mod => {
            const isSelected = mod === currentValue ? 'selected' : '';
            newOptions += `<option value="${mod}" ${isSelected}>${mod}</option>`;
        });
        currentSelect.innerHTML = newOptions;
    });
    const modifierList = document.querySelector('.modifier-list');
    if (modifierList) {
        modifierList.innerHTML = '';
        const displayModifiers = [...allModifiers];
        for (const [value, count] of selectedValues.entries()) {
                for (let i = 0; i < count; i++) {
                    const index = displayModifiers.indexOf(value);
                    if (index > -1) displayModifiers.splice(index, 1);
                }
        }
        allModifiers.forEach(mod => {
            const li = document.createElement('li');
            li.textContent = mod;
            li.className = 'modifier-item';
            if (!displayModifiers.includes(mod)) li.classList.add('used');
            modifierList.appendChild(li);
        });
    }
}

function selectTraits() {
    const assignments = {};
    let allAssigned = true;
    document.querySelectorAll('#trait-selection-container select').forEach(select => {
        const traitName = select.dataset.trait;
        const value = select.value;
        if (value) {
            assignments[traitName] = parseInt(value, 10);
        } else {
            allAssigned = false;
        }
    });
    if (!allAssigned) {
        document.getElementById('trait-error').textContent = 'Please assign a modifier to all six traits.';
        document.getElementById('trait-error').style.display = 'block';
        return;
    }
    document.getElementById('trait-error').style.display = 'none';
    character.traits = assignments;
    displayExperienceSelection(false, displayTraitSelection, selectExperiences);
}

function displayExperienceSelection(isLevelUp, backFunc, nextFunc) {
    const creatorContainer = getCreatorContainer();
    const experienceSelectionStep = document.createElement('div');
    experienceSelectionStep.id = 'experience-selection';
    const numExperiences = isLevelUp ? 1 : 2;
    const title = isLevelUp ? `Gained a New Experience!` : 'Step 6: Create Your Experiences';

    experienceSelectionStep.innerHTML = `<h2>${title}</h2>`;

    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', backFunc);
    const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Confirm Experiences →';
    nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', nextFunc);
    navContainer.appendChild(backButton);
    navContainer.appendChild(nextButton);
    experienceSelectionStep.appendChild(navContainer);

    const content = document.createElement('div');
    content.innerHTML = `<p>Create ${numExperiences === 1 ? 'one new Experience' : 'two Experiences'}. Each starts with a +2 modifier.</p><p><em>${gameData.experiences.instruction}</em></p>`;

    const expContainer = document.createElement('div');
    expContainer.className = 'experience-container';

    const allExperiences = Object.values(gameData.experiences.categories).flat();

    for (let i = 1; i <= numExperiences; i++) {
        const expItem = document.createElement('div');
        expItem.className = 'experience-item';
        expItem.innerHTML = `
            <h4>Experience ${i} <span class="modifier">+2</span></h4>
            <div class="experience-choice-toggle">
                <label><input type="radio" name="exp-type-${i}" value="premade" checked> Select an Example</label>
                <label><input type="radio" name="exp-type-${i}" value="custom"> Write a Custom</label>
            </div>

            <div id="premade-exp-${i}" class="experience-fields">
                <select id="experience-category-${i}" data-index="${i}">
                    <option value="all">--All Categories--</option>
                    ${Object.keys(gameData.experiences.categories).map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
                <select id="experience-name-${i}">
                    <option value="">--Choose Experience--</option>
                    ${allExperiences.map(exp => `<option value="${exp}">${exp}</option>`).join('')}
                </select>
            </div>

            <div id="custom-exp-${i}" class="experience-fields" style="display: none;">
                 <input type="text" id="experience-custom-${i}" placeholder="Enter Custom Experience Name...">
            </div>
            <textarea id="experience-desc-${i}" placeholder="Describe what this experience means..." maxlength="280"></textarea>
        `;
        expContainer.appendChild(expItem);

        expItem.querySelectorAll(`input[name="exp-type-${i}"]`).forEach(radio => {
            radio.addEventListener('change', (event) => {
                const premadeDiv = document.getElementById(`premade-exp-${i}`);
                const customDiv = document.getElementById(`custom-exp-${i}`);
                if (event.target.value === 'custom') {
                    premadeDiv.style.display = 'none';
                    customDiv.style.display = 'block';
                } else {
                    premadeDiv.style.display = 'flex';
                    customDiv.style.display = 'none';
                }
            });
        });

        expItem.querySelector(`#experience-category-${i}`).addEventListener('change', (event) => {
            const category = event.target.value;
            const nameSelect = document.getElementById(`experience-name-${i}`);
            let options = '<option value="">--Choose Experience--</option>';
            let experiencesToList = (category === 'all') ? allExperiences : gameData.experiences.categories[category];
            options += experiencesToList.map(exp => `<option value="${exp}">${exp}</option>`).join('');
            nameSelect.innerHTML = options;
        });
    }

    content.appendChild(expContainer);
    experienceSelectionStep.appendChild(content);
    creatorContainer.appendChild(experienceSelectionStep);
}
function selectExperiences() {
    const experiences = [];
    const numExperiences = document.querySelectorAll('.experience-item').length;
    let allValid = true;

    for (let i = 1; i <= numExperiences; i++) {
        const type = document.querySelector(`input[name="exp-type-${i}"]:checked`).value;
        const desc = document.getElementById(`experience-desc-${i}`).value.trim();
        let experienceName = '';

        if (type === 'custom') {
            experienceName = document.getElementById(`experience-custom-${i}`).value.trim();
        } else {
            experienceName = document.getElementById(`experience-name-${i}`).value;
        }

        if (experienceName) {
            experiences.push({ name: experienceName, description: desc, modifier: 2 });
        } else {
            allValid = false;
        }
    }

    if (!allValid) {
        alert(`Please define all of your ${numExperiences === 1 ? 'new experience' : 'starting experiences'}.`);
        return;
    }

    if (numExperiences > 1) { // Initial character creation
        character.experiences = experiences;
        displayDomainCardSelection();
    } else { // This is a level-up
        levelUpState.tempSelections.newExperience = experiences[0];
        displayChooseAdvancementsPage();
    }
}
function displayDomainCardSelection() {
    const creatorContainer = getCreatorContainer();
    const domainSelectionStep = document.createElement('div');
    domainSelectionStep.id = 'domain-card-selection';
    const availableDomains = character.class.domains;
    const availableCards = gameData.domainCards.filter(card => card.level === 1 && availableDomains.includes(card.domain));
    domainSelectionStep.innerHTML = `<h2>Step 7: Choose Two Domain Cards</h2><p>Your available domains are: <strong>${availableDomains.join(' & ')}</strong>. Select two cards.</p><p>Selected: <span id="selected-cards-count">0</span> / 2</p>`;
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back to Experiences';
    backButton.addEventListener('click', () => displayExperienceSelection(false, displayTraitSelection, selectExperiences));
    
    // We now use the overwritten domains from character.class.domains
    
     const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Confirm Domain Cards →';
    nextButton.style.marginLeft = 'auto';
    nextButton.disabled = true;
    nextButton.addEventListener('click', selectDomainCards);
    navContainer.appendChild(backButton);
    navContainer.appendChild(nextButton);
    domainSelectionStep.appendChild(navContainer);
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    availableCards.forEach(cardData => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.cardName = cardData.name;
        card.innerHTML = `<h3>${cardData.name}</h3><p><em>${cardData.domain} ${cardData.type} (Level ${cardData.level})</em></p><hr>${formatDescription(cardData.description)}`;
        card.addEventListener('click', () => {
            const isSelected = card.classList.contains('selected');
            if (isSelected) {
                card.classList.remove('selected');
                character.domainCards = character.domainCards.filter(c => c.name !== cardData.name);
                const loadoutIndex = character.loadout.indexOf(cardData.name);
                if (loadoutIndex !== -1) character.loadout[loadoutIndex] = null;
            } else if (character.domainCards.length < 2) {
                card.classList.add('selected');
                character.domainCards.push(cardData);
                const emptySlotIndex = character.loadout.indexOf(null);
                if (emptySlotIndex !== -1) {
                    character.loadout[emptySlotIndex] = cardData.name;
                }
            }
            document.getElementById('selected-cards-count').textContent = character.domainCards.length;
            nextButton.disabled = character.domainCards.length !== 2;
        });
        cardsContainer.appendChild(card);
    });
    domainSelectionStep.appendChild(cardsContainer);
    creatorContainer.appendChild(domainSelectionStep);
}
function selectDomainCards() { if (character.domainCards.length === 2) { displayFinalReview(); } }
function displayFinalReview() {
    const creatorContainer = getCreatorContainer();
    const finalReviewStep = document.createElement('div');
    finalReviewStep.id = 'final-review';
    finalReviewStep.innerHTML = `<h2>Step 8: Final Review</h2>
        <div style="text-align: center; margin: 20px 0;">
            <label for="character-name" style="font-weight: bold; font-size: 1.2em; color: #9d78c9;">Character Name: </label>
            <input type="text" id="character-name" value="${character.name.replace('Unnamed Hero', '')}" placeholder="Enter name..." style="padding: 8px; font-size: 1.1em; border: 2px solid #555; border-radius: 4px; width: 300px;">
        </div>
        <p>Review your choices. You can now finalize your character and then equip them from the character sheet.</p>`;
    
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back to Domain Cards';
    backButton.addEventListener('click', () => { 
        character.domainCards = []; 
        character.loadout = [null, null, null, null, null]; 
        // Go back to domain card selection, which will use the (potentially custom) domains
         displayDomainCardSelection(); 
    });
    const finalizeButton = document.createElement('button');
    finalizeButton.className = 'action-button';
    finalizeButton.textContent = 'Finalize & Equip →';
    finalizeButton.style.marginLeft = 'auto';
    finalizeButton.addEventListener('click', () => {
        character.name = document.getElementById('character-name').value.trim() || "Unnamed Hero";
        displayEquipmentSelection(displayFinalReview, false);
    });

    navContainer.appendChild(backButton);
    navContainer.appendChild(finalizeButton);
    finalReviewStep.appendChild(navContainer);

    const traitBanner = document.createElement('div');
    traitBanner.className = 'trait-banner-boxed';
    const traitsOrder = ['Strength', 'Agility', 'Finesse', 'Instinct', 'Presence', 'Knowledge'];
    traitsOrder.forEach(traitName => {
        const traitValue = character.traits[traitName.toLowerCase()];
        const traitItem = document.createElement('div');
        traitItem.className = 'trait-box';
        traitItem.innerHTML = `<div class="name">${traitName.toUpperCase()}</div><div class="value">${traitValue >= 0 ? '+' : ''}${traitValue}</div>`;
        traitBanner.appendChild(traitItem);
    });
    finalReviewStep.appendChild(traitBanner);
    const summary = document.createElement('div');
    summary.innerHTML = `<ul class="summary-list"><li><strong>Class:</strong> ${character.class.name}</li><li><strong>Subclass:</strong> ${character.subclass.name}</li><li><strong>Ancestry:</strong> ${character.ancestry.name}</li><li><strong>Community:</strong> ${character.community.name}</li><li><strong>Experiences:</strong> ${character.experiences.map(e => `'${e.name}' (+${e.modifier})`).join(', ')}</li><li><strong>Domain Cards:</strong> ${character.domainCards.map(c => c.name).join(', ')}</li></ul>`;
    finalReviewStep.appendChild(summary);
    creatorContainer.appendChild(finalReviewStep);
}
function displayEquipmentSelection(backFunc, isReEquip = false) {
    const creatorContainer = getCreatorContainer();
    const equipmentStep = document.createElement('div');
    equipmentStep.id = 'equipment-selection';
    const title = isReEquip ? "Update Your Equipment" : "Final Step: Choose Your Equipment";
    const subtext = isReEquip ? `Select your armor and weapons available at Tier ${getCharacterTier(character.level)} or lower.` : "Select your armor and weapons. You may choose one two-handed primary weapon, OR one one-handed primary weapon.";

    equipmentStep.innerHTML = `<h2>${title}</h2><p>${subtext}</p>`;
    
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', backFunc);
    navContainer.appendChild(backButton);
    
    const finalizeButton = document.createElement('button');
    finalizeButton.id = 'finalize-character-btn';
    finalizeButton.className = 'action-button';
    finalizeButton.textContent = isReEquip ? 'Confirm Equipment →' : 'View Character Sheet →';
    finalizeButton.style.marginLeft = 'auto';
    finalizeButton.disabled = true;
    finalizeButton.addEventListener('click', displayCharacterSheet);
    navContainer.appendChild(finalizeButton);
    equipmentStep.appendChild(navContainer);
    
    const characterTier = getCharacterTier(character.level);

    const armorSection = document.createElement('div');
    armorSection.className = 'equipment-section';
    armorSection.innerHTML = `<h3>1. Choose Your Armor</h3>
        <div class="filter-container">
            <label for="armor-tier-filter">Filter by Tier:</label>
            <select id="armor-tier-filter">
                <option value="all">All Available Tiers</option>
                ${[...Array(characterTier).keys()].map(i => `<option value="${i + 1}">Tier ${i + 1}</option>`).join('')}
            </select>
        </div>`;
    const armorGrid = document.createElement('div');
    armorGrid.id = 'armor-grid';
    armorGrid.className = 'equipment-grid';
    gameData.armor.forEach(armor => { armorGrid.appendChild(createEquipmentCard(armor, 'armor')); });
    armorSection.appendChild(armorGrid);
    equipmentStep.appendChild(armorSection);
    
    const primarySection = document.createElement('div');
    primarySection.className = 'equipment-section';
    primarySection.innerHTML = `<h3>2. Choose Your Primary Weapon</h3>
        <div class="filter-container">
            <label for="primary-weapon-tier-filter">Filter by Tier:</label>
            <select id="primary-weapon-tier-filter">
                <option value="all">All Available Tiers</option>
                ${[...Array(characterTier).keys()].map(i => `<option value="${i + 1}">Tier ${i + 1}</option>`).join('')}
            </select>
            <label for="primary-weapon-wield-filter">Filter by Wield:</label>
            <select id="primary-weapon-wield-filter">
                <option value="all">All</option>
                <option value="One-Handed">One-Handed</option>
                <option value="Two-Handed">Two-Handed</option>
            </select>
            <label for="primary-weapon-trait-filter">Filter by Trait:</label>
            <select id="primary-weapon-trait-filter">
                <option value="all">All Traits</option>
                <option value="Strength">Strength</option> <option value="Agility">Agility</option> <option value="Finesse">Finesse</option>
                <option value="Instinct">Instinct</option> <option value="Presence">Presence</option> <option value="Knowledge">Knowledge</option>
            </select>
        </div>`;
    const primaryGrid = document.createElement('div');
    primaryGrid.id = 'primary-weapon-grid';
    primaryGrid.className = 'equipment-grid';
    gameData.weapons.primary.forEach(weapon => { primaryGrid.appendChild(createEquipmentCard(weapon, 'primary')); });
    primarySection.appendChild(primaryGrid);
    equipmentStep.appendChild(primarySection);

    const secondarySection = document.createElement('div');
    secondarySection.className = 'equipment-section';
    secondarySection.innerHTML = `<h3>3. Choose Your Secondary Weapon (if applicable)</h3>
        <div class="filter-container">
            <label for="secondary-weapon-tier-filter">Filter by Tier:</label>
            <select id="secondary-weapon-tier-filter">
                <option value="all">All Available Tiers</option>
                ${[...Array(characterTier).keys()].map(i => `<option value="${i + 1}">Tier ${i + 1}</option>`).join('')}
            </select>
            <label for="secondary-weapon-trait-filter">Filter by Trait:</label>
            <select id="secondary-weapon-trait-filter">
                <option value="all">All Traits</option>
                <option value="Strength">Strength</option> <option value="Agility">Agility</option> <option value="Finesse">Finesse</option>
                <option value="Instinct">Instinct</option> <option value="Presence">Presence</option> <option value="Knowledge">Knowledge</option>
            </select>
        </div>`;
    const secondaryGrid = document.createElement('div');
    secondaryGrid.id = 'secondary-weapon-grid';
    secondaryGrid.className = 'equipment-grid';
    gameData.weapons.secondary.forEach(weapon => { secondaryGrid.appendChild(createEquipmentCard(weapon, 'secondary')); });
    secondarySection.appendChild(secondaryGrid);
    equipmentStep.appendChild(secondarySection);
    
    creatorContainer.appendChild(equipmentStep);

    document.getElementById('armor-tier-filter').addEventListener('change', (event) => {
        const selectedTier = event.target.value;
        document.querySelectorAll('#armor-grid .equipment-card').forEach(card => {
            const item = gameData.armor.find(a => a.name === card.dataset.itemName);
            if (item.name === 'Unarmored' || selectedTier === 'all' || item.tier == selectedTier) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });

    const primaryWeaponFilterHandler = () => {
        const selectedTier = document.getElementById('primary-weapon-tier-filter').value;
        const selectedWield = document.getElementById('primary-weapon-wield-filter').value;
        const selectedTrait = document.getElementById('primary-weapon-trait-filter').value;
        document.querySelectorAll('#primary-weapon-grid .equipment-card').forEach(card => {
            const weapon = gameData.weapons.primary.find(w => w.name === card.dataset.itemName);
            const tierMatch = (selectedTier === 'all' || weapon.tier == selectedTier);
            const wieldMatch = (selectedWield === 'all' || weapon.burden === selectedWield);
            const traitMatch = (selectedTrait === 'all' || weapon.trait === selectedTrait);
            card.style.display = (tierMatch && wieldMatch && traitMatch) ? 'flex' : 'none';
        });
    };
    document.getElementById('primary-weapon-tier-filter').addEventListener('change', primaryWeaponFilterHandler);
    document.getElementById('primary-weapon-wield-filter').addEventListener('change', primaryWeaponFilterHandler);
    document.getElementById('primary-weapon-trait-filter').addEventListener('change', primaryWeaponFilterHandler);
    
    const secondaryWeaponFilterHandler = () => {
        const selectedTier = document.getElementById('secondary-weapon-tier-filter').value;
        const selectedTrait = document.getElementById('secondary-weapon-trait-filter').value;
        document.querySelectorAll('#secondary-weapon-grid .equipment-card').forEach(card => {
            const weapon = gameData.weapons.secondary.find(w => w.name === card.dataset.itemName);
            const tierMatch = (selectedTier === 'all' || weapon.tier == selectedTier);
            const traitMatch = (selectedTrait === 'all' || weapon.trait === selectedTrait);
            card.style.display = (tierMatch && traitMatch) ? 'flex' : 'none';
        });
    };
    document.getElementById('secondary-weapon-tier-filter').addEventListener('change', secondaryWeaponFilterHandler);
    document.getElementById('secondary-weapon-trait-filter').addEventListener('change', secondaryWeaponFilterHandler);


    if (isReEquip) {
        if (character.equipment.armor) {
            document.querySelector(`.equipment-card[data-item-name="${character.equipment.armor.name}"]`)?.classList.add('selected');
        } else {
            document.querySelector(`.equipment-card[data-item-name="Unarmored"]`)?.classList.add('selected');
        }
        if (character.equipment.primary) {
            document.querySelector(`.equipment-card[data-item-name="${character.equipment.primary.name}"]`)?.classList.add('selected');
        }
        if (character.equipment.secondary) {
            document.querySelector(`.equipment-card[data-item-name="${character.equipment.secondary.name}"]`)?.classList.add('selected');
        }
    }

    updateEquipmentUI();
}
function createEquipmentCard(item, type) {
    const card = document.createElement('div');
    card.className = 'equipment-card';
    card.dataset.itemName = item.name;
    card.dataset.itemType = type;

    const characterTier = getCharacterTier(character.level);
    if (item.tier > characterTier) {
        card.classList.add('disabled');
    }

    let details = `<h4>${item.name}</h4><ul>`;
    if (item.tier > 0) details += `<li><strong>Tier:</strong> ${item.tier}</li>`;
    if (item.thresholds) details += `<li><strong>Thresholds:</strong> ${item.thresholds}</li>`;
    if (item.score) details += `<li><strong>Score:</strong> ${item.score}</li>`;
    if (item.trait) details += `<li><strong>Trait:</strong> ${item.trait}</li>`;
    if (item.range) details += `<li><strong>Range:</strong> ${item.range}</li>`;
    if (item.damage) details += `<li><strong>Damage:</strong> ${item.damage}</li>`;
    if (item.burden) details += `<li><strong>Wield:</strong> ${item.burden}</li>`;
    if (item.feature) details += `<li><strong>Feature:</strong> ${item.feature || 'None'}</li>`;
    details += `</ul>`;
    card.innerHTML = details;
    card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        
        const isSelected = card.classList.contains('selected');
        
        if (item.name === 'Unarmored') {
            document.querySelectorAll(`.equipment-card[data-item-type="armor"]`).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            delete character.equipment.armor;
            updateEquipmentUI();
            return;
        }
        
        const cardsOfType = document.querySelectorAll(`.equipment-card[data-item-type="${type}"]`);
        cardsOfType.forEach(c => c.classList.remove('selected'));

        if (!isSelected) {
            card.classList.add('selected');
            character.equipment[type] = item;
        } else {
            delete character.equipment[type];
        }
        
        if (type === 'primary' && item.burden === 'Two-Handed' && character.equipment.primary) {
            delete character.equipment.secondary;
        }
        
        updateEquipmentUI();
    });
    return card;
}
function updateEquipmentUI() {
    const primaryWeapon = character.equipment.primary;
    const isTwoHanded = primaryWeapon && primaryWeapon.burden === 'Two-Handed';
    document.querySelectorAll('#secondary-weapon-grid .equipment-card').forEach(card => {
        const item = gameData.weapons.secondary.find(w => w.name === card.dataset.itemName);
        const characterTier = getCharacterTier(character.level);
        if (isTwoHanded || (item && item.tier > characterTier)) {
            card.classList.add('disabled');
        } else {
            card.classList.remove('disabled');
        }

        if (isTwoHanded) {
            card.classList.remove('selected');
        }
    });

    if (isTwoHanded) delete character.equipment.secondary;

    const finalizeBtn = document.getElementById('finalize-character-btn');
    if (finalizeBtn) {
        const unarmoredSelected = document.querySelector(`.equipment-card[data-item-name="Unarmored"]`)?.classList.contains('selected');
        const armorSelected = !!character.equipment.armor || unarmoredSelected;
        const primarySelected = !!character.equipment.primary;
        
        if (armorSelected && primarySelected) {
            finalizeBtn.disabled = false;
        } else {
            finalizeBtn.disabled = true;
        }
    }
}
function processFeatureText(text) {
    if(!text) return '';
    let html = '';
    const parts = text.split('\n*');
    const mainDesc = parts[0];
    let hasTokens = mainDesc.toLowerCase().includes('token');
    let hasCheckbox = mainDesc.toLowerCase().includes('per long rest') || mainDesc.toLowerCase().includes('per short rest') || mainDesc.toLowerCase().includes('per rest');
    html += `<p>${mainDesc}</p>`;
    if (parts.length > 1) {
        const subAbilities = parts.slice(1);
        let listHtml = '<ul class="ability-list">';
        subAbilities.forEach(abilityText => {
            let itemHtml = '<li class="ability-list-item">';
            if (hasCheckbox) {
                itemHtml += '<div class="ability-checkbox" onclick="this.classList.toggle(\'checked\')"></div>';
            }
            let processedText = abilityText.trim();
            if (processedText.toLowerCase().includes('token')) {
                    let counterId = `token-counter-${Math.random().toString(36).substr(2, 9)}`;
                    processedText += `<div class="token-counter" id="${counterId}"><button onclick="updateTokenCount('${counterId}', -1)">-</button><span data-count>0</span><button onclick="updateTokenCount('${counterId}', 1)">+</button></div>`;
            }
            itemHtml += `<div class="ability-list-item-text">${processedText}</div></li>`;
            listHtml += itemHtml;
        });
        listHtml += '</ul>';
        html += listHtml;
    } else if (hasTokens) {
        let counterId = `token-counter-${Math.random().toString(36).substr(2, 9)}`;
        html += `<div class="token-counter" id="${counterId}"><button onclick="updateTokenCount('${counterId}', -1)">-</button><span data-count>0</span><button onclick="updateTokenCount('${counterId}', 1)">+</button></div>`;
    }
    return html;
}
function updateTokenCount(counterId, change) {
    const counterElement = document.getElementById(counterId);
    const span = counterElement.querySelector('span[data-count]');
    let currentCount = parseInt(span.textContent, 10);
    currentCount += change;
    if (currentCount < 0) currentCount = 0;
    span.textContent = currentCount;
}


// --- FINAL CHARACTER SHEET DISPLAY ---
function displayCharacterSheet() {
    document.getElementById('character-creator').innerHTML = '';
    document.getElementById('character-creator').classList.add('hidden');
    const sheetContainer = document.getElementById('character-sheet-container');
    sheetContainer.innerHTML = '';
    sheetContainer.classList.remove('hidden');

    // --- NEW LAYOUT PATCH ---
    // Inject CSS to create the new layout from your image
    const injectedCSS = document.createElement('style');
    injectedCSS.innerHTML = `
        .sheet-top-row {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            gap: 20px;
            width: 100%;
            margin-bottom: 20px;
        }
        #sheet-top-left {
            flex: 1;
            min-width: 200px; /* Tracker width */
        }
        #sheet-top-center {
            flex: 2; /* Equipment section is widest */
        }
        #sheet-top-right {
            flex: 1;
            min-width: 200px; /* Experiences width */
        }
        #sheet-top-left #trackers-condensed {
            grid-template-columns: 1fr; /* Stack trackers vertically */
            gap: 10px;
        }
        .scattered-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            background-color: #2a2a2e;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 15px;
            text-align: center;
        }
        .scattered-stat-box {
            font-size: 0.9em;
        }
        .scattered-stat-box .name {
            font-weight: bold;
            color: #9d78c9;
            text-transform: uppercase;
            font-size: 0.8em;
            letter-spacing: 0.5px;
        }
        .scattered-stat-box .value {
            font-size: 1.4em;
            font-weight: bold;
            color: #fff;
        }
    `;
    // --- END NEW LAYOUT PATCH ---

    const sheet = document.createElement('div');
    sheet.id = 'character-sheet';

    const page1 = document.createElement('div');
    page1.className = 'sheet-page';
    page1.appendChild(injectedCSS); // Add our new layout rules

    const header = document.createElement('div');
    header.className = 'sheet-header';

    const leftButtons = document.createElement('div');
    leftButtons.style.justifySelf = 'start';
    leftButtons.style.display = 'flex';
    leftButtons.style.gap = '10px';

    const printButton = document.createElement('button');
    printButton.className = 'action-button';
    printButton.textContent = 'Print/Save PDF';
    printButton.addEventListener('click', printCharacterSheet);

    const saveButton = document.createElement('button');
    saveButton.className = 'action-button';
    saveButton.textContent = 'Save Character';
    saveButton.style.backgroundColor = '#5cb85c';
    saveButton.addEventListener('click', saveCharacter);

    leftButtons.appendChild(printButton);
    leftButtons.appendChild(saveButton);


    const title = document.createElement('h2');
    let titleText = `${character.name} (Lvl ${character.level}) - ${character.ancestry.name} ${character.class.name}`;
    if (character.multiclass) {
        titleText += ` / ${character.multiclass}`;
    }
    title.textContent = titleText;

    header.appendChild(leftButtons);
    header.appendChild(title);
    page1.appendChild(header);

    const coreStatsContainer = document.createElement('div');
    coreStatsContainer.className = 'core-stats-container';
    
    const traitBanner = document.createElement('div');
    traitBanner.className = 'trait-banner-boxed';
    const traitsOrder = ['Strength', 'Agility', 'Finesse', 'Instinct', 'Presence', 'Knowledge'];
    const displayTraits = { ...character.traits };
    
    let evasionModifier = 0;
    for (const key in character.equipment) {
        const item = character.equipment[key];
        if (item && item.feature) {
            const features = item.feature.split(';');
            features.forEach(featurePart => {
                const evasionMatch = featurePart.trim().match(/(-?\d+)\s+to\s+Evasion/i);
                const traitMatch = featurePart.trim().match(/(-?\d+)\s+to\s+(\w+)/i);

                if (evasionMatch) { evasionModifier += parseInt(evasionMatch[1], 10); } 
                else if (traitMatch) {
                    const modifier = parseInt(traitMatch[1], 10);
                    const traitName = traitMatch[2].toLowerCase();
                    if (displayTraits.hasOwnProperty(traitName)) { displayTraits[traitName] += modifier; }
                }
            });
        }
    }

    traitsOrder.forEach(traitName => {
        const traitKey = traitName.toLowerCase();
        const traitValue = displayTraits[traitKey];
        const traitItem = document.createElement('div');
        traitItem.className = 'trait-box';
        traitItem.innerHTML = `<div class="name">${traitName.toUpperCase()}</div><div class="value">${(typeof traitValue === 'number') ? (traitValue >= 0 ? '+' : '') + traitValue : 'undefined'}</div>`;
        traitBanner.appendChild(traitItem);
    });
    coreStatsContainer.appendChild(traitBanner);
    page1.appendChild(coreStatsContainer); // Add Trait Banner
    
    // --- REMOVED secondaryStatsBar ---

    // --- CALCULATE ALL STATS ---
    const chosenProficiencyBonus = character.advancementsTaken['increase_proficiency'] || 0;
    character.proficiency = getBaseProficiency(character.level) + chosenProficiencyBonus;
    character.evasion = character.class.starting_evasion + (character.advancementsTaken['increase_evasion'] || 0) + evasionModifier;
    
    let armorScore = 0;
    let baseThresholds;
    const hasBareBones = character.domainCards.some(card => card.name === 'Bare Bones');
    if (!character.equipment.armor) {
        if (hasBareBones) {
            const tier = getCharacterTier(character.level); 
            armorScore = 3 + (character.traits.strength || 0);
            switch(tier) {
                case 1: baseThresholds = [9, 19]; break;
                case 2: baseThresholds = [11, 24]; break;
                case 3: baseThresholds = [13, 31]; break;
                case 4: baseThresholds = [15, 38]; break;
                default: baseThresholds = [9, 19];
            }
        } else {
            baseThresholds = [character.level, character.level * 2];
            armorScore = 0;
        }
    } else {
        armorScore = (character.equipment.armor.score || 0) + (character.equipment.secondary && character.equipment.secondary.feature.includes("Armor Score") ? parseInt(character.equipment.secondary.feature.match(/\+(\d+)/)[1], 10) : 0);
        baseThresholds = character.equipment.armor.thresholds.split('/').map(t => parseInt(t, 10));
    }
    const thresholdBonus = character.thresholdBonus || 0;
    character.majorThreshold = baseThresholds[0] + thresholdBonus;
    character.severeThreshold = baseThresholds[1] + thresholdBonus;


    // --- NEW LAYOUT: TOP ROW ---
    const topRow = document.createElement('div');
    topRow.className = 'sheet-top-row';

    // --- Top Left: Trackers ---
    const topLeft = document.createElement('div');
    topLeft.id = 'sheet-top-left';
    const trackers = document.createElement('div');
    trackers.id = 'trackers-condensed';
    const hpSlots = character.class.starting_hp + (character.advancementsTaken['add_hp'] || 0);
    const stressSlots = (character.class.starting_hp + (character.advancementsTaken['add_stress'] || 0)) + (character.ancestry.name === 'Human' ? 1 : 0) + (character.subclass.name === 'Vengeance' ? 1 : 0);
    trackers.appendChild(createTracker('HP', hpSlots, 'hp'));
    trackers.appendChild(createTracker('Hope', 6, 'hope'));
    trackers.appendChild(createTracker('Stress', stressSlots, 'stress'));
    trackers.appendChild(createTracker('Armor', armorScore, 'armor', armorScore));
    topLeft.appendChild(trackers);
    topRow.appendChild(topLeft);

    // --- Top Center: Equipment (with scattered stats) ---
    const topCenter = document.createElement('div');
    topCenter.id = 'sheet-top-center';
    const equipSection = document.createElement('div');
    equipSection.className = 'sheet-section';
    
    let scatteredStatsHTML = `<div class="scattered-stats-grid">
        <div class="scattered-stat-box"><div class="name">Evasion</div><div class="value">${character.evasion}</div></div>
        <div class="scattered-stat-box"><div class="name">Thresholds</div><div class="value">${character.majorThreshold}/${character.severeThreshold}</div></div>
        <div class="scattered-stat-box"><div class="name">Proficiency</div><div class="value">${character.proficiency}</div></div>
    `;
    if (character.subclass.spellcast_trait) {
        scatteredStatsHTML += `<div class="scattered-stat-box"><div class="name">Spellcast Trait</div><div class="value">${character.subclass.spellcast_trait}</div></div>`;
    }
    scatteredStatsHTML += `</div>`;

    let equipHTML = `<h3>Equipment</h3>${scatteredStatsHTML}`;
    
    if (character.equipment.primary) {
        const createItemHTML = (item) => {
            let html = `<ul>`;
            if(item.tier) html += `<li><strong>Tier:</strong> ${item.tier}</li>`;
            if(item.thresholds) html += `<li><strong>Thresholds:</strong> ${item.thresholds}</li>`;
            if(item.score) html += `<li><strong>Score:</strong> ${item.score}</li>`;
            if(item.trait) html += `<li><strong>Trait:</strong> ${item.trait}</li>`;
            if(item.range) html += `<li><strong>Range:</strong> ${item.range}</li>`;
            if(item.damage) {
                let primaryDamageDice = item.damage.split('d')[1];
                let primaryDamage = `${character.proficiency}d${primaryDamageDice}`;
                html += `<li><strong>Damage:</strong> ${primaryDamage}</li>`;
            }
            if(item.burden) html += `<li><strong>Wield:</strong> ${item.burden}</li>`;
            if(item.feature) html += `<li><strong>Feature:</strong> ${item.feature}</li>`;
            html += '</ul>';
            return html;
        };

        equipHTML += '<div class="equipment-layout-grid">';
        if (character.equipment.armor) {
            equipHTML += `<div class="equipment-item-display"><h5>${character.equipment.armor.name} (Armor)</h5>${createItemHTML(character.equipment.armor)}</div>`;
        } else {
            equipHTML += `<div class="equipment-item-display"><h5>Unarmored</h5><p>No armor equipped.</p></div>`;
        }
        equipHTML += `<div class="equipment-item-display"><h5>${character.equipment.primary.name} (Primary)</h5>${createItemHTML(character.equipment.primary)}</div>`;
        if (character.equipment.secondary) {
            equipHTML += `<div class="equipment-item-display"><h5>${character.equipment.secondary.name} (Secondary)</h5>${createItemHTML(character.equipment.secondary)}</div>`;
        }
        equipHTML += '</div>';

    } else {
        equipHTML += `<p>No equipment selected. You can select equipment via the 'Change Equipment' button.</p>`;
    }
    equipSection.innerHTML = equipHTML;
    topCenter.appendChild(equipSection);
    topRow.appendChild(topCenter);

    // --- Top Right: Experiences ---
    const topRight = document.createElement('div');
    topRight.id = 'sheet-top-right';
    const expSection = document.createElement('div');
    expSection.className = 'sheet-section';
    expSection.innerHTML = `<h3>Experiences</h3><ul class="summary-list">${character.experiences.map(e => `<li><strong>${e.name} (+${e.modifier}):</strong> ${e.description || 'No description.'}</li>`).join('')}</ul>`;
    topRight.appendChild(expSection);
    topRow.appendChild(topRight);
    
    // Add the completed top row to Page 1
    page1.appendChild(topRow);

    // --- NEW LAYOUT: BOTTOM ROW (Full Width) ---
    // --- Features & Abilities ---
    const featuresSection = document.createElement('div');
    featuresSection.className = 'sheet-section';
    
    // ADDED HOPE FEATURE
    let hopeFeatureHTML = `<h4>${character.class.hope_feature.name} (Hope)</h4>${processFeatureText(character.class.hope_feature.description)}`;
    let classFeaturesHTML = `<h4>${character.class.class_feature.name} (Class)</h4>${processFeatureText(character.class.class_feature.description)}`;
    if (character.class_feature_multiclass) {
        classFeaturesHTML += `<hr><h4>${character.class_feature_multiclass.name} (${character.multiclass})</h4>${processFeatureText(character.class_feature_multiclass.description)}`;
    }
    let subclassFeaturesHTML = `<h4>${character.subclass.foundation_feature.name} (Subclass)</h4>${processFeatureText(character.subclass.foundation_feature.description)}`;
    if (character.multiclassFoundationFeature) {
        subclassFeaturesHTML += `<hr><h4>${character.multiclassFoundationFeature.name} (${character.multiclass} Subclass)</h4>${processFeatureText(character.multiclassFoundationFeature.description)}`;
    }
    if (character.specialization_feature) {
        subclassFeaturesHTML += `<hr><h4>${character.specialization_feature.name} (Specialization)</h4>${processFeatureText(character.specialization_feature.description)}`;
    }
    if(character.multiclassSpecializationFeature) {
        subclassFeaturesHTML += `<hr><h4>${character.multiclassSpecializationFeature.name} (${character.multiclass} Specialization)</h4>${processFeatureText(character.multiclassSpecializationFeature.description)}`;
    }
    if (character.mastery_feature) {
        subclassFeaturesHTML += `<hr><h4>${character.mastery_feature.name} (Mastery)</h4>${processFeatureText(character.mastery_feature.description)}`;
    }
    let ancestryFeaturesHTML = character.ancestry.features.map(f => `<h4>${f.name} (Ancestry)</h4>${processFeatureText(f.description)}`).join('');
    
    featuresSection.innerHTML = `<h3>Features & Abilities</h3>
        <div class="feature-list-item">${hopeFeatureHTML}</div>
        <div class="feature-list-item">${classFeaturesHTML}</div>
        <div class="feature-list-item">${subclassFeaturesHTML}</div>
        <div class="feature-list-item">${ancestryFeaturesHTML}</div>
        <div class="feature-list-item"><h4>${character.community.feature.name} (Community)</h4><p>${character.community.feature.description}</p></div>`;
    
    page1.appendChild(featuresSection); // Appended directly to page1, so it's full-width
    
    sheet.appendChild(page1);

    // --- Page 2: Loadout (Restored to original logic) ---
    const page2 = document.createElement('div');
    page2.className = 'sheet-page';
    const vaultButtonHTML = `<div style="text-align: right; margin-top: 20px; margin-bottom: 15px;"><button class="action-button" style="margin: 0;" onclick="openVaultModal()">View Vault</button></div>`;
    const loadoutSection = document.createElement('div');
    loadoutSection.className = 'sheet-section';
    loadoutSection.innerHTML = `<h3>Domain Card Loadout (${character.loadout.filter(c => c).length}/5)</h3>`;
    const loadoutGrid = document.createElement('div');
    loadoutGrid.className = 'domain-loadout-grid';
    
    for (let i = 0; i < 5; i++) {
        const cardName = character.loadout[i];
        const card = cardName ? character.domainCards.find(c => c.name === cardName) : null;
        const slot = document.createElement('div');
        slot.className = 'domain-card-slot';

        if (card) {
            slot.innerHTML = `
                <div class="card-management">
                    <h4>${card.name}</h4>
                    <div class="buttons">
                       <button class="move-btn" onclick="swapDomainCard(${i})">Swap</button>
                       <button class="move-btn" onclick="moveDomainCard(${i})">To Vault</button>
                    </div>
                </div>
                ${processFeatureText(card.description)}
            `;
        } else {
            slot.classList.add('empty');
            slot.textContent = 'Empty Slot';
            slot.onclick = () => addToEmptySlot(i);
        }
        loadoutGrid.appendChild(slot);
    }
    loadoutSection.appendChild(loadoutGrid);
    
    page2.innerHTML = vaultButtonHTML;
    page2.appendChild(loadoutSection);
    sheet.appendChild(page2);
    // --- END PAGE 2 ---
    
    sheetContainer.appendChild(sheet);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'step-nav';
    buttonContainer.style.justifyContent = 'center';
    
    const revertButton = document.createElement('button');
    revertButton.id = 'revert-level-button';
    revertButton.className = 'action-button';
    revertButton.textContent = 'Revert to Previous Level';
    revertButton.style.backgroundColor = '#6c757d';
    revertButton.disabled = characterHistory.length === 0;
    revertButton.addEventListener('click', () => {
        if (confirm("Are you sure you want to revert to the previous level? Any changes made since the last level-up will be lost.")) {
            if (characterHistory.length > 0) {
                character = characterHistory.pop();
                displayCharacterSheet();
            }
        }
    });

    const equipButton = document.createElement('button');
    equipButton.id = 'equip-button';
    equipButton.className = 'action-button';
    equipButton.textContent = 'Change Equipment';
    equipButton.style.backgroundColor = '#5cb85c';
    equipButton.addEventListener('click', () => {
        displayEquipmentSelection(displayCharacterSheet, true);
    });

    const levelUpButton = document.createElement('button');
    levelUpButton.id = 'level-up-button';
    levelUpButton.className = 'action-button';
    levelUpButton.textContent = 'Level Up';
    levelUpButton.addEventListener('click', startLevelUpProcess);

    buttonContainer.appendChild(revertButton);
    buttonContainer.appendChild(equipButton);
    buttonContainer.appendChild(levelUpButton);

    sheetContainer.appendChild(buttonContainer);
}


function createTracker(label, total, type, activeTotal = total) {
    const tracker = document.createElement('div');
    tracker.className = 'tracker';
    const trackerLabel = document.createElement('div');
    trackerLabel.className = 'tracker-label';
    if (type === 'armor') {
        trackerLabel.textContent = `${label}: ${activeTotal}`;
    } else {
        trackerLabel.textContent = `${label} (${activeTotal}/${total})`;
    }
    const boxes = document.createElement('div');
    boxes.className = 'tracker-boxes';
    for(let i=0; i<total; i++) {
        const box = document.createElement('div');
        box.className = 'tracker-box';
        if (type === 'armor') {
            box.addEventListener('click', () => box.classList.toggle('filled'));
        } else {
            if (i >= activeTotal) box.classList.add('disabled');
            else box.addEventListener('click', () => box.classList.toggle('filled'));
        }
        boxes.appendChild(box);
    }
    tracker.appendChild(trackerLabel);
    tracker.appendChild(boxes);
    return tracker;
}

// --- LEVEL UP WIZARD LOGIC ---
function startLevelUpProcess() {
    if (character.level >= 10) {
        alert("You have reached the maximum level!");
        return;
    }
    characterHistory.push(JSON.parse(JSON.stringify(character)));

    const newLevel = character.level + 1;
    
    if (newLevel === 2 || newLevel === 5 || newLevel === 8) {
        character.advancementsTakenThisTier = {};
    }

    levelUpState = {
        isLevelingUp: true,
        newLevel: newLevel,
        advancementQueue: [],
        tempSelections: {}
    };
    displayTierAchievementsPage();
}
function displayTierAchievementsPage() {
    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    const newLevel = levelUpState.newLevel;
    let achievementsHTML = '';
    let hasNewExperience = false;

    if (newLevel === 2 || newLevel === 5 || newLevel === 8) {
        achievementsHTML += '<li>Gain a new Experience at +2</li>';
        achievementsHTML += '<li>Your base Proficiency increases automatically.</li>';
        hasNewExperience = true;

        if (newLevel === 5 || newLevel === 8) {
            achievementsHTML += '<li>You can now improve traits that you boosted in the previous tier.</li>';
        }
    } else {
        achievementsHTML = '<li>No automatic Tier Achievements at this level.</li>';
    }

    step.innerHTML = `<h2>Leveling Up to ${newLevel}: Tier Achievements</h2><p>You automatically gain the following benefits:</p><ul>${achievementsHTML}</ul>`;
    
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Continue →';
    nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', () => {
        if (hasNewExperience) {
            displayExperienceSelection(true, () => {
                delete levelUpState.tempSelections.newExperience;
                displayTierAchievementsPage();
            }, selectExperiences);
        } else {
            displayChooseAdvancementsPage();
        }
    });

    navContainer.appendChild(nextButton);
    step.appendChild(navContainer);
    creatorContainer.appendChild(step);
}
function displayChooseAdvancementsPage() {
    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    const newLevel = levelUpState.newLevel;
    const currentTierKey = getTierKey(newLevel);
    const currentTierNum = getCharacterTier(newLevel);

    const availableAdvancements = new Map();
    for (const tierKey in gameData.advancements) {
        if (getCharacterTier(newLevel) >= parseInt(tierKey.slice(-1), 10)) {
            gameData.advancements[tierKey].forEach(adv => {
                availableAdvancements.set(adv.id, adv);
            });
        }
    }
    
    step.innerHTML = `<h2>Step 2: Choose Advancements</h2><p>Select 2 points worth of advancements from the list below.</p>`;

    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button'); backButton.className = 'back-btn'; backButton.textContent = '← Back';
    backButton.addEventListener('click', () => {
        levelUpState.tempSelections = {};
        levelUpState.advancementQueue = [];
        displayTierAchievementsPage();
    });
    const nextButton = document.createElement('button'); nextButton.className = 'action-button'; nextButton.textContent = 'Confirm Selections →'; nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', processAdvancementSelections);
    navContainer.appendChild(backButton);
    navContainer.appendChild(nextButton);
    step.appendChild(navContainer);

    const advancementsContainer = document.createElement('div');
    advancementsContainer.style.marginTop = '20px';

    availableAdvancements.forEach(adv => {
        const totalTimesTaken = character.advancementsTaken[adv.id] || 0;
        const timesTakenThisTier = character.advancementsTakenThisTier[adv.id] || 0;
        
        const advDefForCurrentTier = gameData.advancements[currentTierKey]?.find(a => a.id === adv.id);
        const limit = advDefForCurrentTier ? advDefForCurrentTier.selections_per_tier : 0;

        let isDisabled = false;
        if (adv.id === 'upgrade_subclass' || adv.id === 'multiclass') {
            if (timesTakenThisTier >= 1) isDisabled = true;
        } else {
            if (totalTimesTaken >= limit) isDisabled = true;
        }

        if (adv.id === 'upgrade_subclass') {
            const totalOverallTaken = character.advancementsTaken['upgrade_subclass'] || 0;
            if ((character.multiclass && totalOverallTaken >= 1) || (!character.multiclass && totalOverallTaken >= 2)) {
                isDisabled = true;
            }
        } else if (adv.id === 'multiclass') {
            if (character.multiclass || newLevel < 5) {
                isDisabled = true;
            }
        }
        
        const label = (adv.id === 'upgrade_subclass' || adv.id === 'multiclass')
            ? `<i>${timesTakenThisTier}/1 taken this tier</i>`
            : `<i>${totalTimesTaken}/${limit} taken</i>`;

        const advEl = document.createElement('div');
        advEl.innerHTML = `
            <input type="checkbox" id="adv-${adv.id}" name="advancements" value="${adv.id}" data-cost="${adv.cost}" ${isDisabled ? 'disabled' : ''}>
            <label for="adv-${adv.id}" style="${isDisabled ? 'text-decoration: line-through; color: #999;' : ''}">
                <b>${adv.name}</b> (Cost: ${adv.cost}) - ${label}
            </label>
        `;
        advancementsContainer.appendChild(advEl);
    });

    step.appendChild(advancementsContainer);
    creatorContainer.appendChild(step);
    
    const upgradeSubclassCheckbox = document.getElementById('adv-upgrade_subclass');
    const multiclassCheckbox = document.getElementById('adv-multiclass');
    const upgradeSubclassLabel = upgradeSubclassCheckbox ? document.querySelector('label[for="adv-upgrade_subclass"]') : null;
    const multiclassLabel = multiclassCheckbox ? document.querySelector('label[for="adv-multiclass"]') : null;

    const handleExclusivity = () => {
        const isUpgradeChecked = upgradeSubclassCheckbox && upgradeSubclassCheckbox.checked;
        const isMulticlassChecked = multiclassCheckbox && multiclassCheckbox.checked;
        
        const tierExclusiveTaken = 
            (character.advancementsTakenThisTier['upgrade_subclass'] || 0) > 0 ||
            (character.advancementsTakenThisTier['multiclass'] || 0) > 0;
        
        const isMulticlassOriginallyDisabled = (character.multiclass || newLevel < 5);
        const totalUpgradesTaken = character.advancementsTaken['upgrade_subclass'] || 0;
        const isUpgradeOriginallyDisabled = (character.multiclass && totalUpgradesTaken >= 1) || (!character.multiclass && totalUpgradesTaken >= 2);

        if (multiclassCheckbox && multiclassLabel) {
            const isDisabled = isMulticlassOriginallyDisabled || isUpgradeChecked || tierExclusiveTaken;
            multiclassCheckbox.disabled = isDisabled;
            if(isDisabled) {
                multiclassLabel.style.textDecoration = 'line-through';
                multiclassLabel.style.color = '#999';
            } else {
                multiclassLabel.style.textDecoration = 'none';
                multiclassLabel.style.color = '';
            }
        }

        if (upgradeSubclassCheckbox && upgradeSubclassLabel) {
            const isDisabled = isUpgradeOriginallyDisabled || isMulticlassChecked || tierExclusiveTaken;
            upgradeSubclassCheckbox.disabled = isDisabled;
            if(isDisabled) {
                upgradeSubclassLabel.style.textDecoration = 'line-through';
                upgradeSubclassLabel.style.color = '#999';
            } else {
                upgradeSubclassLabel.style.textDecoration = 'none';
                upgradeSubclassLabel.style.color = '';
            }
        }
    };

    if (upgradeSubclassCheckbox) upgradeSubclassCheckbox.addEventListener('change', handleExclusivity);
    if (multiclassCheckbox) multiclassCheckbox.addEventListener('change', handleExclusivity);
    
    handleExclusivity();
}

function processAdvancementSelections() {
    const selectedCheckboxes = Array.from(document.querySelectorAll('input[name="advancements"]:checked'));
    const totalCost = selectedCheckboxes.reduce((sum, cb) => sum + parseInt(cb.dataset.cost), 0);
    
    if (totalCost !== 2) {
        alert("You must select exactly 2 points worth of advancements.");
        return;
    }
    
    levelUpState.advancementQueue = [];
    levelUpState.tempSelections.simpleAdvancements = [];
    
    selectedCheckboxes.forEach(cb => {
        const advId = cb.value;
        let advData = null;
        ['tier4', 'tier3', 'tier2'].forEach(tier => {
            const found = gameData.advancements[tier]?.find(a => a.id === advId);
            if (found && !advData) advData = found;
        });

        if (advData) {
            const complexIds = ['increase_traits', 'increase_experience', 'take_domain_card_t2', 'take_domain_card_t3', 'take_domain_card_t4', 'multiclass', 'upgrade_subclass'];
            if (complexIds.includes(advId)) {
                levelUpState.advancementQueue.push(advData);
            } else {
                levelUpState.tempSelections.simpleAdvancements.push(advData);
            }
        } else {
            console.error(`Could not find advancement data for id: ${advId}`);
        }
    });
    
    processNextAdvancementInQueue();
}
function processNextAdvancementInQueue() {
    if (levelUpState.advancementQueue.length === 0) {
        displayRequiredDomainCardPage();
        return;
    }
    
    const nextAdv = levelUpState.advancementQueue.shift();
    
    switch(nextAdv.id) {
        case 'increase_traits':
            displayIncreaseTraitsPage(nextAdv);
            break;
        case 'increase_experience':
            displayIncreaseExperiencesPage(nextAdv);
            break;
        case 'take_domain_card_t2':
        case 'take_domain_card_t3':
        case 'take_domain_card_t4':
            displayAdvancementDomainCardPage(nextAdv);
            break;
        case 'multiclass':
            displayMulticlassClassChoicePage(nextAdv);
            break;
        case 'upgrade_subclass':
            displayUpgradeSubclassPage(nextAdv);
            break;
        default:
            processNextAdvancementInQueue();
            break;
    }
}
function displayIncreaseTraitsPage(advData) {
    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    step.innerHTML = `<h2>Advancement: Increase Traits</h2><p>Choose 2 traits to increase by +1. You cannot increase the same trait twice in the same tier.</p>`;

    const navContainer = document.createElement('div');
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', () => {
        delete levelUpState.tempSelections.traitIncreases;
        levelUpState.advancementQueue.unshift(advData);
        displayChooseAdvancementsPage();
    });
    navContainer.appendChild(backButton);
    
    const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Confirm Traits →';
    nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', () => {
        const checked = document.querySelectorAll('input[name="trait-choice"]:checked');
        if (checked.length !== 2) {
            alert('You must select exactly two traits.');
            return;
        }
        levelUpState.tempSelections.traitIncreases = [];
        checked.forEach(cb => {
            levelUpState.tempSelections.traitIncreases.push(cb.value);
        });
        processNextAdvancementInQueue();
    });

    navContainer.appendChild(nextButton);
    step.appendChild(navContainer);

    const traitGrid = document.createElement('div');
    traitGrid.className = 'trait-selection-grid';

    const currentTierKey = getTierKey(levelUpState.newLevel);
    const boostedThisTier = character.traitBoostsByTier[currentTierKey] || [];

    for (const trait in character.traits) {
        const isMarkedThisTier = boostedThisTier.includes(trait);
        const traitItem = document.createElement('div');
        traitItem.className = 'trait-selection-box';
        traitItem.innerHTML = `<label style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; cursor: pointer;">
            <div style="font-weight: bold; text-transform: uppercase; color: #9d78c9;">${trait.charAt(0).toUpperCase() + trait.slice(1)}</div>
            <div style="font-size: 1.5em; font-weight: bold;">(Current: ${character.traits[trait]})</div>
            <input type="checkbox" name="trait-choice" value="${trait}" ${isMarkedThisTier ? 'disabled' : ''} style="margin-top: 10px;">
        </label>`;
        traitGrid.appendChild(traitItem);
    }

    step.appendChild(traitGrid);
    creatorContainer.appendChild(step);
}
function displayIncreaseExperiencesPage(advData) {
    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    step.innerHTML = `<h2>Advancement: Increase Experiences</h2><p>Choose two experiences to increase their modifier by +1.</p>`;

    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', () => {
        delete levelUpState.tempSelections.experienceIncreases;
        levelUpState.advancementQueue.unshift(advData);
        displayChooseAdvancementsPage();
    });
    navContainer.appendChild(backButton);

    const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Confirm Experiences →';
    nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', () => {
        const checked = document.querySelectorAll('input[name="experience-choice"]:checked');
        if (checked.length !== 2) {
            alert('You must select exactly two experiences.');
            return;
        }
        levelUpState.tempSelections.experienceIncreases = [];
        checked.forEach(cb => {
            levelUpState.tempSelections.experienceIncreases.push(cb.value);
        });
        processNextAdvancementInQueue();
    });

    navContainer.appendChild(nextButton);
    step.appendChild(navContainer);

    const experiencesContainer = document.createElement('div');
    
    let allAvailableExperiences = [...character.experiences];
    if (levelUpState.tempSelections.newExperience) {
        allAvailableExperiences.push(levelUpState.tempSelections.newExperience);
    }

    allAvailableExperiences.forEach(exp => {
        const expItem = document.createElement('div');
        expItem.innerHTML = `<label style="padding: 10px; display: block;"><input type="checkbox" name="experience-choice" value="${exp.name}"> <strong>${exp.name}</strong> (Current: +${exp.modifier || 2})</label>`;
        experiencesContainer.appendChild(expItem);
    });

    step.appendChild(experiencesContainer);
    creatorContainer.appendChild(step);
}
function displayAdvancementDomainCardPage(advData) {
    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    step.innerHTML = `<h2>Advancement: ${advData.name}</h2><p>Select one additional domain card.</p>`;

    let advancementMaxLevel = 0;
    switch (advData.id) {
        case 'take_domain_card_t2':
            advancementMaxLevel = 4;
            break;
        case 'take_domain_card_t3':
            advancementMaxLevel = 7;
            break;
        case 'take_domain_card_t4':
            advancementMaxLevel = 10;
            break;
        default:
            advancementMaxLevel = levelUpState.newLevel;
            break;
    }

    const finalMaxLevel = Math.min(levelUpState.newLevel, advancementMaxLevel);

    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button'); backButton.className = 'back-btn'; backButton.textContent = '← Back';
    backButton.addEventListener('click', () => { delete levelUpState.tempSelections.advancementDomainCard; levelUpState.advancementQueue.unshift(advData); displayChooseAdvancementsPage(); });
    navContainer.appendChild(backButton);
    const nextButton = document.createElement('button'); nextButton.className = 'action-button'; nextButton.textContent = 'Confirm Card →'; nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', () => { const selectedCard = document.querySelector('input[name="advancement_domain_card"]:checked'); if (!selectedCard) { alert('Please select a domain card.'); return; } levelUpState.tempSelections.advancementDomainCard = {card: gameData.domainCards.find(c => c.name === selectedCard.value), advId: advData.id}; processNextAdvancementInQueue(); });
    navContainer.appendChild(nextButton);
    step.appendChild(navContainer);
    
    const halfLevel = Math.ceil(levelUpState.newLevel / 2);
    let eligibleCards = [];

    character.class.domains.forEach(domain => {
        eligibleCards.push(...gameData.domainCards.filter(card => 
            card.domain === domain && card.level <= finalMaxLevel
        ));
    });

    const multiclassDomain = character.multiclassDomain || levelUpState.tempSelections.multiclassDetails?.domain;
    if (multiclassDomain) {
        eligibleCards.push(...gameData.domainCards.filter(card => 
            card.domain === multiclassDomain && card.level <= halfLevel && card.level <= finalMaxLevel
        ));
    }

    const temporarilySelectedCard = levelUpState.tempSelections.advancementDomainCard?.card;
    const finalCardList = eligibleCards.filter(card => { return !character.domainCards.some(c => c.name === card.name) && !(temporarilySelectedCard && temporarilySelectedCard.name === card.name); });
    
    const uniqueCardList = [...new Map(finalCardList.map(item => [item.name, item])).values()];
    
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    uniqueCardList.forEach(card => { 
        const cardId = `adv-domain-card-${card.name.replace(/\s+/g, '-')}`;
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.innerHTML = `<input type="radio" id="${cardId}" name="advancement_domain_card" value="${card.name}" class="hidden-radio"><label for="${cardId}" style="width:100%; height:100%; cursor: pointer;"><h4>${card.name}</h4><p><em>${card.domain} ${card.type} (Lvl ${card.level})</em></p><hr>${formatDescription(card.description)}</label>`;
        cardDiv.addEventListener('click', () => {
            document.querySelectorAll('#character-creator .card').forEach(c => c.classList.remove('selected'));
            cardDiv.classList.add('selected');
            cardDiv.querySelector('input').checked = true;
        });
        cardsContainer.appendChild(cardDiv);
    });
    
    step.appendChild(cardsContainer);
    creatorContainer.appendChild(step);
}
function displayMulticlassClassChoicePage(advData) {
    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    step.innerHTML = `<h2>Multiclass (1/2): Choose a New Class</h2>`;
    
    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back to Advancements';
    backButton.addEventListener('click', () => {
        levelUpState.advancementQueue.unshift(advData);
        displayChooseAdvancementsPage();
    });
    navContainer.appendChild(backButton);
    step.appendChild(navContainer);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    gameData.classes.filter(c => c.name !== character.class.name).forEach(classData => {
        const card = document.createElement('div');
        card.className = 'card';

        const primaryDomains = character.class.domains;
        const multiclassDomains = classData.domains;
        const sharedDomains = primaryDomains.filter(domain => multiclassDomains.includes(domain));
        
        let warningHTML = '';
        if (sharedDomains.length > 0) {
            warningHTML = `<p style="font-style: italic; color: #8a6d3b; background-color: #fcf8e3; border: 1px solid #faebcc; padding: 5px; border-radius: 4px; font-size: 0.8em; margin-top: 10px;">Note: This class shares the ${sharedDomains.join(', ')} domain(s) with your primary class.</p>`;
        }

        card.innerHTML = `<h3>${classData.name}</h3>${formatDescription(classData.description)}${warningHTML}`;
        card.addEventListener('click', () => {
            levelUpState.tempSelections.multiclass = classData;
            displayMulticlassDetailPage(advData);
        });
        cardsContainer.appendChild(card);
    });
    step.appendChild(cardsContainer);
    creatorContainer.appendChild(step);
}
function displayMulticlassDetailPage(advData) {
    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    const newClass = levelUpState.tempSelections.multiclass;

    step.innerHTML = `<h2>Multiclass (2/2): Choose Details for ${newClass.name}</h2><p>Select one Domain and one Subclass Foundation.</p>`;

    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back to Class Choice';
    backButton.addEventListener('click', () => {
        delete levelUpState.tempSelections.multiclass;
        displayMulticlassClassChoicePage(advData);
    });

    const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Confirm Multiclass →';
    nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', () => {
        const domainChoice = document.querySelector('input[name="multiclass-domain"]:checked');
        const subclassChoice = document.querySelector('input[name="multiclass-subclass"]:checked');
        if (!domainChoice || !subclassChoice) {
            alert('Please select one domain and one subclass.');
            return;
        }
        levelUpState.tempSelections.multiclassDetails = {
            domain: domainChoice.value,
            subclass: newClass.subclasses.find(sc => sc.name === subclassChoice.value)
        };
        processNextAdvancementInQueue();
    });

    navContainer.appendChild(backButton);
    navContainer.appendChild(nextButton);
    step.appendChild(navContainer); 

    const contentContainer = document.createElement('div');

    let domainHTML = '<h3>Choose a Domain</h3>';
    newClass.domains.forEach(domain => {
        const exampleCards = gameData.domainCards.filter(c => c.domain === domain && c.level === 1).slice(0, 4);
        let examplesHTML = '<div class="cards-container" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-left: 25px; margin-top: 10px;">';
        exampleCards.forEach(card => {
            examplesHTML += `<div class="card" style="font-size: 0.8em; padding: 10px; cursor: default;"><h4>${card.name}</h4><p>${card.description.substring(0, 100)}...</p></div>`;
        });
        examplesHTML += '</div>';
        
        domainHTML += `<div><label><input type="radio" name="multiclass-domain" value="${domain}"> <strong>${domain}</strong></label>${examplesHTML}</div>`;
    });
    contentContainer.innerHTML = domainHTML;
    
    contentContainer.innerHTML += '<hr><h3>Choose a Subclass Foundation</h3>';

    const subclassCardsContainer = document.createElement('div');
    subclassCardsContainer.className = 'cards-container';
    newClass.subclasses.forEach(subclass => {
        const cardId = `multiclass-subclass-${subclass.name.replace(/\s+/g, '-')}`;
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <input type="radio" name="multiclass-subclass" value="${subclass.name}" id="${cardId}" class="hidden-radio">
            <label for="${cardId}" style="cursor: pointer; width: 100%; height: 100%;">
                <h3>${subclass.name}</h3>
                <hr>
                <h4>Foundation: ${subclass.foundation_feature.name}</h4>
                ${formatDescription(subclass.foundation_feature.description)}
            </label>
        `;
        card.addEventListener('click', () => {
            document.getElementById(cardId).checked = true;
            document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
        subclassCardsContainer.appendChild(card);
    });

    contentContainer.appendChild(subclassCardsContainer);
    step.appendChild(contentContainer); 
    creatorContainer.appendChild(step);
}
function displayRequiredDomainCardPage() {
    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    step.innerHTML = `<h2>Final Step: Acquire Domain Card</h2><p>You acquire one new domain card of your new level or lower.</p>`;

    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', displayChooseAdvancementsPage);
    
    const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Finish Level Up →';
    nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', finalizeLevelUp);
    
    navContainer.appendChild(backButton);
    navContainer.appendChild(nextButton);
    step.appendChild(navContainer);
    
    const fullLevel = levelUpState.newLevel;
    const halfLevel = Math.ceil(fullLevel / 2);
    let eligibleCards = [];

    character.class.domains.forEach(domain => {
        eligibleCards.push(...gameData.domainCards.filter(card => 
            card.domain === domain && card.level <= fullLevel
        ));
    });

    const multiclassDomain = character.multiclassDomain || levelUpState.tempSelections.multiclassDetails?.domain;

    if (multiclassDomain) {
        eligibleCards.push(...gameData.domainCards.filter(card => 
            card.domain === multiclassDomain && card.level <= halfLevel
        ));
    }

    const temporarilySelectedCard = levelUpState.tempSelections.advancementDomainCard?.card;
    const finalCardList = eligibleCards.filter(card => {
        const alreadyOwned = character.domainCards.some(charCard => charCard.name === card.name);
        const tempSelected = temporarilySelectedCard && temporarilySelectedCard.name === card.name;
        return !alreadyOwned && !tempSelected;
    });
    
    const uniqueCardList = [...new Map(finalCardList.map(item => [item.name, item])).values()];
    
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    uniqueCardList.forEach(card => {
        const cardId = `required-domain-card-${card.name.replace(/\s+/g, '-')}`;
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.innerHTML = `<input type="radio" id="${cardId}" name="required_domain_card" value="${card.name}" class="hidden-radio"><label for="${cardId}" style="width:100%; height:100%; cursor: pointer;"><h4>${card.name}</h4><p><em>${card.domain} ${card.type} (Lvl ${card.level})</em></p><hr>${formatDescription(card.description)}</label>`;
        cardDiv.addEventListener('click', () => {
            document.querySelectorAll('#character-creator .card').forEach(c => c.classList.remove('selected'));
            cardDiv.classList.add('selected');
            cardDiv.querySelector('input').checked = true;
        });
        cardsContainer.appendChild(cardDiv);
    });
    
    step.appendChild(cardsContainer);
    creatorContainer.appendChild(step);
}
function finalizeLevelUp() {
    const selectedCard = document.querySelector('input[name="required_domain_card"]:checked');
    if (!selectedCard) {
        alert('Please select a domain card to acquire.');
        return;
    }
    const newLevel = levelUpState.newLevel;
    
    if (levelUpState.tempSelections.simpleAdvancements) {
        levelUpState.tempSelections.simpleAdvancements.forEach(adv => {
            character.advancementsTaken[adv.id] = (character.advancementsTaken[adv.id] || 0) + 1;
            character.advancementsTakenThisTier[adv.id] = (character.advancementsTakenThisTier[adv.id] || 0) + 1;
        });
    }

    if (levelUpState.tempSelections.subclassUpgrade) {
        const upgrade = levelUpState.tempSelections.subclassUpgrade;
        if (upgrade.type === 'specialization') {
            if (upgrade.class === character.class.name) {
                character.specialization_feature = character.subclass.specialization_feature;
            } else {
                const multiSubclassData = gameData.classes.find(c => c.name === character.multiclass).subclasses.find(sc => sc.foundation_feature.name === character.multiclassFoundationFeature.name);
                character.multiclassSpecializationFeature = multiSubclassData.specialization_feature;
            }
        } else if (upgrade.type === 'mastery') {
            character.mastery_feature = character.subclass.mastery_feature;
        }
        character.advancementsTaken['upgrade_subclass'] = (character.advancementsTaken['upgrade_subclass'] || 0) + 1;
        character.advancementsTakenThisTier['upgrade_subclass'] = (character.advancementsTakenThisTier['upgrade_subclass'] || 0) + 1;
    }

    if (levelUpState.tempSelections.traitIncreases) {
        const currentTierKey = getTierKey(newLevel);
        if(!character.traitBoostsByTier[currentTierKey]) character.traitBoostsByTier[currentTierKey] = [];
        levelUpState.tempSelections.traitIncreases.forEach(traitName => {
            character.traits[traitName]++;
            character.traitBoostsByTier[currentTierKey].push(traitName);
        });
        character.advancementsTaken['increase_traits'] = (character.advancementsTaken['increase_traits'] || 0) + 1;
        character.advancementsTakenThisTier['increase_traits'] = (character.advancementsTakenThisTier['increase_traits'] || 0) + 1;
    }
    
    if (levelUpState.tempSelections.experienceIncreases) {
        levelUpState.tempSelections.experienceIncreases.forEach(expNameToIncrease => {
            let experience = character.experiences.find(e => e.name === expNameToIncrease);
            if (!experience && levelUpState.tempSelections.newExperience?.name === expNameToIncrease) {
                experience = levelUpState.tempSelections.newExperience;
            }
            if (experience) {
                experience.modifier++;
            }
        });
        character.advancementsTaken['increase_experience'] = (character.advancementsTaken['increase_experience'] || 0) + 1;
        character.advancementsTakenThisTier['increase_experience'] = (character.advancementsTakenThisTier['increase_experience'] || 0) + 1;
    }

    if (levelUpState.tempSelections.advancementDomainCard) {
        const { card, advId } = levelUpState.tempSelections.advancementDomainCard;
        character.domainCards.push(card);
        const emptySlotIndex = character.loadout.indexOf(null);
        if (emptySlotIndex !== -1) {
            character.loadout[emptySlotIndex] = card.name;
        }
        character.advancementsTaken[advId] = (character.advancementsTaken[advId] || 0) + 1;
        character.advancementsTakenThisTier[advId] = (character.advancementsTakenThisTier[advId] || 0) + 1;
    }
    if (levelUpState.tempSelections.multiclass && levelUpState.tempSelections.multiclassDetails) {
        const newClass = levelUpState.tempSelections.multiclass;
        const details = levelUpState.tempSelections.multiclassDetails;

        character.multiclass = newClass.name;
        character.multiclassDomain = details.domain;
        character.multiclassFoundationFeature = details.subclass.foundation_feature;
        character.class_feature_multiclass = newClass.class_feature;

        character.advancementsTaken['multiclass'] = 1;
        character.advancementsTakenThisTier['multiclass'] = 1;
    }

    if (newLevel === 2 || newLevel === 5 || newLevel === 8) {
        if (levelUpState.tempSelections.newExperience) {
            character.experiences.push(levelUpState.tempSelections.newExperience);
        }
    }
    
    const cardObject = gameData.domainCards.find(c => c.name === selectedCard.value);
    character.domainCards.push(cardObject);
    const emptySlotIndex = character.loadout.indexOf(null);
    if (emptySlotIndex !== -1) {
        character.loadout[emptySlotIndex] = cardObject.name;
    }
    
    character.thresholdBonus = (character.thresholdBonus || 0) + 1;
    character.level = newLevel;
    
    levelUpState = {};
    
    displayCharacterSheet();
}
function displayUpgradeSubclassPage(advData) {
    if (!character.multiclass) {
        if (!character.specialization_feature) {
            levelUpState.tempSelections.subclassUpgrade = { type: 'specialization', class: character.class.name };
        } else {
            levelUpState.tempSelections.subclassUpgrade = { type: 'mastery', class: character.class.name };
        }
        processNextAdvancementInQueue();
        return;
    }

    const creatorContainer = getCreatorContainer();
    const step = document.createElement('div');
    step.innerHTML = `<h2>Upgrade a Subclass to Specialization</h2><p>As a multiclassed character, you can only upgrade one of your subclasses to its Specialization. Choose which subclass to upgrade.</p>`;

    const navContainer = document.createElement('div');
    navContainer.className = 'step-nav';
    const backButton = document.createElement('button');
    backButton.className = 'back-btn';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', () => {
        delete levelUpState.tempSelections.subclassUpgrade;
        levelUpState.advancementQueue.unshift(advData);
        displayChooseAdvancementsPage();
    });
    const nextButton = document.createElement('button');
    nextButton.className = 'action-button';
    nextButton.textContent = 'Confirm Upgrade →';
    nextButton.style.marginLeft = 'auto';
    nextButton.addEventListener('click', () => {
        const choice = document.querySelector('input[name="subclass-upgrade-choice"]:checked');
        if (!choice) {
            alert("Please choose a subclass to upgrade.");
            return;
        }
        levelUpState.tempSelections.subclassUpgrade = { type: 'specialization', class: choice.value };
        processNextAdvancementInQueue();
    });
    navContainer.appendChild(backButton);
    navContainer.appendChild(nextButton);
    step.appendChild(navContainer);
    
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';

    const createUpgradeCard = (className, subclassData, feature) => {
        const card = document.createElement('div');
        card.className = 'card';
        const cardId = `upgrade-${className.replace(/\s+/g, '-')}`;
        card.innerHTML = `<input type="radio" name="subclass-upgrade-choice" value="${className}" id="${cardId}" class="hidden-radio">
            <label for="${cardId}" style="cursor: pointer; width: 100%; height: 100%;">
                <h3>${subclassData.name} (${className})</h3><hr>
                <h4>Specialization: ${feature.name}</h4>
                ${formatDescription(feature.description)}
            </label>`;
        
        card.addEventListener('click', () => {
            document.getElementById(cardId).checked = true;
            document.querySelectorAll('#character-creator .card.selected').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });

        return card;
    };

    const primaryCard = createUpgradeCard(character.class.name, character.subclass, character.subclass.specialization_feature);
    cardsContainer.appendChild(primaryCard);

    const multiClassData = gameData.classes.find(c => c.name === character.multiclass);
    const multiSubclassData = multiClassData.subclasses.find(sc => sc.foundation_feature.name === character.multiclassFoundationFeature.name);
    const secondaryCard = createUpgradeCard(character.multiclass, multiSubclassData, multiSubclassData.specialization_feature);
    cardsContainer.appendChild(secondaryCard);
    
    step.appendChild(cardsContainer);
    creatorContainer.appendChild(step);
}
function generateTestCharacter(targetLevel, isPreview = false, className = 'any') {
    let genChar = { 
        name: "Test Hero",
        thresholdBonus: 0,
        domainCards: [],
        loadout: [null, null, null, null, null],
        level: 1,
        equipment: {},
        advancementsTakenThisTier: {},
        traitBoostsByTier: { tier2: [], tier3: [], tier4: [] },
        advancementsTaken: {},
        multiclass: null,
        multiclassDomain: null,
        multiclassFoundationFeature: null,
        class_feature_multiclass: null,
        multiclassSpecializationFeature: null,
    };
    let generatorPreviewInfo = {};

    let randomClass;
    if (className === 'any') {
        randomClass = gameData.classes[Math.floor(Math.random() * gameData.classes.length)];
    } else {
        randomClass = gameData.classes.find(c => c.name === className);
    }
    
    genChar.class = randomClass; 
    genChar.subclass = randomClass.subclasses[Math.floor(Math.random() * randomClass.subclasses.length)];
    genChar.ancestry = gameData.ancestries[Math.floor(Math.random() * gameData.ancestries.length)];
    genChar.community = gameData.communities[Math.floor(Math.random() * gameData.communities.length)];
    
    genChar.traits = Object.entries(randomClass.suggested_traits).reduce((acc, [key, value]) => {
        acc[key.toLowerCase()] = value;
        return acc;
    }, {});
    
    const allExperiences = Object.values(gameData.experiences.categories).flat();
    allExperiences.sort(() => 0.5 - Math.random());
    
    // --- GOAL 3 PATCH V2: Get primary trait from suggested_traits ---
    let primaryTrait = 'Strength'; // Default
    let maxTrait = -Infinity;
    for(const [trait, value] of Object.entries(randomClass.suggested_traits)) {
        if(value > maxTrait) { maxTrait = value; primaryTrait = trait; }
    }
    
    genChar.experiences = [
        { name: allExperiences.pop(), description: 'No description.', modifier: 2 },
        { name: allExperiences.pop(), description: 'No description.', modifier: 2 }
    ];

    const availableDomains = genChar.class.domains;
    const startingCardsPool = gameData.domainCards.filter(card => card.level === 1 && availableDomains.includes(card.domain));
    if(startingCardsPool.length > 0) {
        const card1 = startingCardsPool.splice(Math.floor(Math.random() * startingCardsPool.length), 1)[0];
        genChar.domainCards.push(card1);
        genChar.loadout[0] = card1.name;
    }
    if(startingCardsPool.length > 0) {
        const card2 = startingCardsPool.splice(Math.floor(Math.random() * startingCardsPool.length), 1)[0];
        genChar.domainCards.push(card2);
        genChar.loadout[1] = card2.name;
    }
    
    for (let currentLevel = 1; currentLevel < targetLevel; currentLevel++) {
        const newLevel = currentLevel + 1;
        const tierKey = getTierKey(newLevel);
        const currentTier = getCharacterTier(newLevel);
        
        if (newLevel === 2 || newLevel === 5 || newLevel === 8) {
            genChar.advancementsTakenThisTier = {};
            const newExpName = allExperiences.pop() || `Generated Lvl ${newLevel} Exp`;
            genChar.experiences.push({ name: newExpName, description: 'No description.', modifier: 2 });
             if (newLevel === 5) genChar.traitBoostsByTier.tier2 = [];
             if (newLevel === 8) genChar.traitBoostsByTier.tier3 = [];
        }

        let pointsToSpend = 2;

        while (pointsToSpend > 0) {
            let allAdvancements = [];
            if (currentTier >= 2) allAdvancements.push(...gameData.advancements.tier2);
            if (currentTier >= 3) allAdvancements.push(...gameData.advancements.tier3);
            if (currentTier >= 4) allAdvancements.push(...gameData.advancements.tier4);
            
            const uniqueAdvancementsMap = new Map();
            allAdvancements.forEach(adv => uniqueAdvancementsMap.set(adv.id, adv));

            const totalLimits = {};
            uniqueAdvancementsMap.forEach(adv => {
                let limit = 0;
                 if (currentTier >= 4 && gameData.advancements.tier4.find(a => a.id === adv.id)) { limit = gameData.advancements.tier4.find(a => a.id === adv.id).selections_per_tier; } 
                else if (currentTier >= 3 && gameData.advancements.tier3.find(a => a.id === adv.id)) { limit = gameData.advancements.tier3.find(a => a.id === adv.id).selections_per_tier; } 
                else if (currentTier >= 2 && gameData.advancements.tier2.find(a => a.id === adv.id)) { limit = gameData.advancements.tier2.find(a => a.id === adv.id).selections_per_tier; }
                totalLimits[adv.id] = limit;
            });

            const validChoices = Array.from(uniqueAdvancementsMap.values()).filter(adv => {
                const totalTimesTaken = genChar.advancementsTaken[adv.id] || 0;
                const timesTakenThisTier = genChar.advancementsTakenThisTier[adv.id] || 0;
                
                if (adv.cost > pointsToSpend) return false;

                if (adv.id === 'multiclass' || adv.id === 'upgrade_subclass') {
                    if (timesTakenThisTier >= 1) return false;
                } else {
                    if (totalTimesTaken >= totalLimits[adv.id]) return false;
                }

                if (adv.id === 'multiclass' && (genChar.multiclass || newLevel < 5)) return false;
                const totalUpgradesTaken = genChar.advancementsTaken['upgrade_subclass'] || 0;
                if (adv.id === 'upgrade_subclass' && ((genChar.multiclass && totalUpgradesTaken >= 1) || (!genChar.multiclass && totalUpgradesTaken >= 2))) return false;
                
                const tierExclusiveTakenThisTier = genChar.advancementsTakenThisTier['multiclass'] || genChar.advancementsTakenThisTier['upgrade_subclass'];
                if( (adv.id === 'multiclass' || adv.id === 'upgrade_subclass') && tierExclusiveTakenThisTier) return false;

                return true;
            });
            
            if (validChoices.length === 0) break;

            let chosenAdv;
            const specialOptions = validChoices.filter(v => v.id === 'multiclass' || v.id === 'upgrade_subclass');

            // Separate multiclass and upgrade_subclass for individual consideration
            const multiclassOption = specialOptions.find(v => v.id === 'multiclass');
            const upgradeOption = specialOptions.find(v => v.id === 'upgrade_subclass');

            // Give each a separate chance to be selected
            if (multiclassOption && Math.random() < 0.15 && pointsToSpend >= multiclassOption.cost) {
                chosenAdv = multiclassOption;
            } else if (upgradeOption && Math.random() < 0.5 && pointsToSpend >= upgradeOption.cost) {
                chosenAdv = upgradeOption;
            } else {
                const nonSpecial = validChoices.filter(v => v.id !== 'multiclass' && v.id !== 'upgrade_subclass');
                if (nonSpecial.length > 0) {
                    chosenAdv = nonSpecial[Math.floor(Math.random() * nonSpecial.length)];
                } else if (specialOptions.length > 0) {
                    // Fallback to a random special option if no non-special options are available
                    chosenAdv = specialOptions[Math.floor(Math.random() * specialOptions.length)];
                } else {
                    chosenAdv = null;
                }
            }
            
            if (!chosenAdv) break; 
            
            genChar.advancementsTaken[chosenAdv.id] = (genChar.advancementsTaken[chosenAdv.id] || 0) + 1;
            genChar.advancementsTakenThisTier[chosenAdv.id] = (genChar.advancementsTakenThisTier[chosenAdv.id] || 0) + 1;
            pointsToSpend -= chosenAdv.cost;

            switch(chosenAdv.id) {
                case 'increase_traits': {
                    const boostedThisTier = genChar.traitBoostsByTier[tierKey] || [];
                    const availableTraits = Object.keys(genChar.traits).filter(t => !boostedThisTier.includes(t));
                    availableTraits.sort(() => 0.5 - Math.random());
                    if (availableTraits.length >= 2) {
                        const trait1 = availableTraits.pop();
                        const trait2 = availableTraits.pop();
                        genChar.traits[trait1]++;
                        genChar.traits[trait2]++;
                        if(!genChar.traitBoostsByTier[tierKey]) genChar.traitBoostsByTier[tierKey] = [];
                        genChar.traitBoostsByTier[tierKey].push(trait1, trait2);
                    }
                    break;
                }
                case 'increase_experience': {
                     const experiencesToBoost = [...genChar.experiences];
                     experiencesToBoost.sort(() => 0.5 - Math.random());
                     if (experiencesToBoost.length >= 2) {
                         experiencesToBoost[0].modifier++;
                         experiencesToBoost[1].modifier++;
                     } else if (experiencesToBoost.length === 1) {
                         experiencesToBoost[0].modifier++;
                     }
                    break;
                }
                case 'multiclass': {
                    const possibleClasses = gameData.classes.filter(c => c.name !== genChar.class.name);
                    const newClass = possibleClasses[Math.floor(Math.random() * possibleClasses.length)];
                    genChar.multiclass = newClass.name;
                    genChar.multiclassDomain = newClass.domains[Math.floor(Math.random() * newClass.domains.length)];
                    const newSubclass = newClass.subclasses[Math.floor(Math.random() * newClass.subclasses.length)];
                    genChar.multiclassFoundationFeature = newSubclass.foundation_feature;
                    genChar.class_feature_multiclass = newClass.class_feature;
                    generatorPreviewInfo.multiclassChoice = newSubclass.name;
                    break;
                }
                case 'upgrade_subclass': {
                    let upgradeMade = '';
                    if (genChar.multiclass) {
                        if (Math.random() > 0.5 && !genChar.specialization_feature) {
                            genChar.specialization_feature = genChar.subclass.specialization_feature;
                            upgradeMade = `${genChar.subclass.name} Specialization`;
                        } else if (!genChar.multiclassSpecializationFeature) {
                            const multiClassData = gameData.classes.find(c => c.name === genChar.multiclass);
                            const multiSubclassData = multiClassData.subclasses.find(sc => sc.foundation_feature.name === genChar.multiclassFoundationFeature.name);
                            genChar.multiclassSpecializationFeature = multiSubclassData.specialization_feature;
                            upgradeMade = `${multiSubclassData.name} Specialization`;
                        }
                    } else {
                        if (!genChar.specialization_feature) {
                            genChar.specialization_feature = genChar.subclass.specialization_feature;
                            upgradeMade = `${genChar.subclass.name} Specialization`;
                        } else if (!genChar.mastery_feature) {
                            genChar.mastery_feature = genChar.subclass.mastery_feature;
                            upgradeMade = `${genChar.subclass.name} Mastery`;
                        }
                    }
                    if(upgradeMade) generatorPreviewInfo.subclassUpgrade = upgradeMade;
                    break;
                }
            }
        }
        
        genChar.thresholdBonus++;
        const allPossibleDomains = [...genChar.class.domains];
        if (genChar.multiclassDomain) allPossibleDomains.push(genChar.multiclassDomain);
        const possibleCards = gameData.domainCards.filter(c => allPossibleDomains.includes(c.domain) && c.level <= newLevel && !genChar.domainCards.some(dc => dc.name === c.name));
        if (possibleCards.length > 0) {
            const chosenCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
            genChar.domainCards.push(chosenCard);
            const emptySlotIndex = genChar.loadout.indexOf(null);
            if (emptySlotIndex !== -1) {
                genChar.loadout[emptySlotIndex] = chosenCard.name;
            }
        }

        genChar.level = newLevel; 
    }

    const charTier = getCharacterTier(genChar.level);

    // Armor Selection
    let preferredArmorPool = gameData.armor.filter(a => {
        return a.tier === charTier && a.name.includes(getTierPrefix(charTier));
    });
    if (preferredArmorPool.length === 0) { 
        preferredArmorPool = gameData.armor.filter(a => a.tier === charTier);
    }
    // Ensure armor pool is not empty
    if(preferredArmorPool.length > 0) {
        genChar.equipment.armor = preferredArmorPool[Math.floor(Math.random() * preferredArmorPool.length)];
    }

    // --- GOAL 3 PATCH V2: Weapon Selection based on Primary Trait ---
    let baseWeaponPool = gameData.weapons.primary.filter(w => w.tier === charTier);
    let finalWeaponPool = baseWeaponPool.filter(w => w.trait === primaryTrait);

    // Failsafe in case no weapon matches the primary trait
    if (finalWeaponPool.length === 0) { finalWeaponPool = baseWeaponPool; }
    if (finalWeaponPool.length > 0) {
        genChar.equipment.primary = finalWeaponPool[Math.floor(Math.random() * finalWeaponPool.length)];
    }


    if (genChar.equipment.primary && genChar.equipment.primary.burden !== 'Two-Handed') {
        const availableSecondary = gameData.weapons.secondary.filter(w => w.tier <= charTier);
         if (availableSecondary.length > 0) {
            genChar.equipment.secondary = availableSecondary[Math.floor(Math.random() * availableSecondary.length)];
        }
    }

    // --- END GOAL 3 PATCH V2 ---
    tempGeneratedCharacter = genChar; 

    if (isPreview) {
        const previewArea = document.getElementById('generator-preview-area');
        const hp = genChar.class.starting_hp + (genChar.advancementsTaken['add_hp'] || 0);
        const stress = (genChar.class.starting_hp + (genChar.advancementsTaken['add_stress'] || 0)) + (genChar.ancestry.name === 'Human' ? 1 : 0) + (genChar.subclass.name === 'Vengeance' ? 1 : 0);
        const spellcastTraitText = genChar.subclass.spellcast_trait ? `<li><strong>Spellcast Trait:</strong> ${genChar.subclass.spellcast_trait}</li>` : '';
        const multiclassText = generatorPreviewInfo.multiclassChoice ? `<li><strong>Multiclass:</strong> ${generatorPreviewInfo.multiclassChoice}</li>` : '';
        const upgradeText = generatorPreviewInfo.subclassUpgrade ? `<li><strong>Subclass Upgrade:</strong> ${generatorPreviewInfo.subclassUpgrade}</li>` : '';

        // Safety check for equipment in case pools were empty
        const primaryWeaponName = genChar.equipment.primary ? genChar.equipment.primary.name : "Unarmed";
        const armorName = genChar.equipment.armor ? genChar.equipment.armor.name : "Unarmored";

        let previewHTML = `
            <h4>Preview: Level ${genChar.level} ${genChar.ancestry.name} ${genChar.class.name} ${genChar.multiclass ? `/ ${genChar.multiclass}` : ''}</h4>
            <ul style="text-align: left; font-size: 0.9em; padding-left: 20px;">
                <li><strong>HP/Stress Slots:</strong> ${hp}/${stress}</li>
                ${spellcastTraitText} ${multiclassText} ${upgradeText}
                <li><strong>Equipped:</strong> ${primaryWeaponName} & ${armorName}</li>
                <li><strong>Sample Cards:</strong> ${genChar.domainCards.slice(0, 3).map(c => c.name).join(', ')}</li>
            </ul>
            <button id="finalize-preview-btn" class="action-button" style="margin: 10px 0 0;">Finalize This Character</button>
        `;
        previewArea.innerHTML = previewHTML;
        
        document.getElementById('finalize-preview-btn').addEventListener('click', () => {
            character = tempGeneratedCharacter;
            displayCharacterSheet();
        });
    }
}
function printCharacterSheet() {
    console.log("Generating PDF...");
    const sheet = document.getElementById('character-sheet');
    
    if (!sheet) {
        console.error("Could not find the #character-sheet element to print.");
        return;
    }

    // --- NEW VAULT PAGE LOGIC ---
    const vaultCards = character.domainCards.filter(card => !character.loadout.includes(card.name));
    let vaultPrintPage = null; // To store the new element

    if (vaultCards.length > 0) {
        vaultPrintPage = document.createElement('div');
        vaultPrintPage.className = 'sheet-page';
        vaultPrintPage.id = 'vault-print-page'; // For easy removal
        vaultPrintPage.style.paddingTop = "0.5in"; // Add padding to avoid header collision on new page

        let vaultHTML = `<div class="sheet-section">
                        <h3>Domain Card Vault</h3>
                        <div class="domain-loadout-grid">`; // Use same class for styling

        vaultCards.forEach(card => {
            vaultHTML += `
                <div class="domain-card-slot">
                    <h4>${card.name}</h4>
                    <p><em>${card.domain} ${card.type} (Level ${card.level})</em></p>
                    <hr>
                    ${processFeatureText(card.description)}
                </div>
            `;
        });

        vaultHTML += '</div></div>';
        vaultPrintPage.innerHTML = vaultHTML;
        sheet.appendChild(vaultPrintPage); // Add the vault page to the sheet
    }
    // --- END NEW VAULT PAGE LOGIC ---
    
    const options = {
        margin:       0.5,
        filename:     `${(character.name || 'character').replace(/\s+/g, '_')}_level_${character.level}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Use .then() to ensure cleanup happens after save
    html2pdf().from(sheet).set(options).save().then(() => {
        if (vaultPrintPage) {
            vaultPrintPage.remove(); // Clean up the added vault page
        }
        console.log("PDF generated and vault page removed.");
    });
}

function getTierPrefix(tier) {
    switch (tier) {
        case 2: return 'Improved';
        case 3: return 'Advanced';
        case 4: return 'Legendary';
        default: return '';
    }
}
