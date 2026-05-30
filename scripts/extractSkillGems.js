// Extract skill gems from the PoE2 wiki page and save as JSON
// Usage: node scripts/extractSkillGems.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const cheerio = require('cheerio');

const URL = 'https://pathofexile2.wiki.fextralife.com/Skill+Gems';
const OUTPUT_PATH = path.resolve(__dirname, '../src/data/SkillGems.json');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseSkillGems(html) {
  const $ = cheerio.load(html);
  const skills = [];

  // Look for tables with skill gems data
  $('table.wiki_table').each((_, table) => {
    const headers = [];
    $(table).find('thead tr th, thead tr td').each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    // Check if this looks like a skill gems table
    if (headers.includes('name') || headers.includes('skill') || headers.includes('gem')) {
      $(table).find('tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const name = $(cells[0]).text().trim();
          const description = $(cells[1]).text().trim();

          if (name && name.length > 0) {
            // Extract damage-related info from description
            const skill = {
              id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              name,
              description,
              moreDamageMultipliersPct: extractMoreDamage(description),
              moreAttackSpeedMultipliersPct: extractMoreAttackSpeed(description),
              type: classifySkillType(name, description)
            };

            skills.push(skill);
          }
        }
      });
    }
  });

  // Also look for individual skill entries in lists or divs
  $('.skill-entry, .gem-entry').each((_, entry) => {
    const name = $(entry).find('.skill-name, .gem-name, h3, h4').first().text().trim();
    const description = $(entry).text().trim();

    if (name) {
      const skill = {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        description,
        moreDamageMultipliersPct: extractMoreDamage(description),
        moreAttackSpeedMultipliersPct: extractMoreAttackSpeed(description),
        type: classifySkillType(name, description)
      };

      skills.push(skill);
    }
  });

  return skills.filter((skill, index, self) =>
    index === self.findIndex(s => s.id === skill.id)
  );
}

function extractMoreDamage(text) {
  const matches = text.match(/(\d+)%\s+more\s+damage/gi);
  return matches ? matches.map(m => parseInt(m.match(/(\d+)/)[1])) : [];
}

function extractMoreAttackSpeed(text) {
  const matches = text.match(/(\d+)%\s+more\s+attack\s+speed/gi);
  return matches ? matches.map(m => parseInt(m.match(/(\d+)/)[1])) : [];
}

function classifySkillType(name, description) {
  const lower = (name + ' ' + description).toLowerCase();

  if (lower.includes('attack') || lower.includes('melee') || lower.includes('bow') || lower.includes('strike')) {
    return 'Attack';
  } else if (lower.includes('spell') || lower.includes('cast') || lower.includes('magic')) {
    return 'Spell';
  } else if (lower.includes('aura') || lower.includes('buff')) {
    return 'Aura';
  } else if (lower.includes('support')) {
    return 'Support';
  }

  return 'Active';
}

async function main() {
  try {
    console.log('Fetching skill gems page...');
    const html = await fetchPage(URL);

    console.log('Parsing skill gems...');
    const skills = parseSkillGems(html);

    // Add some default skills if extraction fails or returns few results
    if (skills.length < 10) {
      console.log('Adding default skills as fallback...');
      skills.push(
        {
          id: 'cleave',
          name: 'Cleave',
          description: 'Attacks enemies in a cone, dealing area damage',
          moreDamageMultipliersPct: [20],
          moreAttackSpeedMultipliersPct: [],
          type: 'Attack'
        },
        {
          id: 'heavy-strike',
          name: 'Heavy Strike',
          description: 'A powerful single-target attack',
          moreDamageMultipliersPct: [40],
          moreAttackSpeedMultipliersPct: [],
          type: 'Attack'
        },
        {
          id: 'glacial-cascade',
          name: 'Glacial Cascade',
          description: 'Ice spell that deals cold damage in sequence',
          moreDamageMultipliersPct: [25],
          moreAttackSpeedMultipliersPct: [],
          type: 'Spell'
        },
        {
          id: 'fireball',
          name: 'Fireball',
          description: 'Launches a fiery projectile',
          moreDamageMultipliersPct: [30],
          moreAttackSpeedMultipliersPct: [],
          type: 'Spell'
        },
        {
          id: 'viper-strike',
          name: 'Viper Strike',
          description: 'Fast attack with poison damage',
          moreDamageMultipliersPct: [40],
          moreAttackSpeedMultipliersPct: [10],
          type: 'Attack'
        }
      );
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(skills, null, 2));

    console.log(`Extracted ${skills.length} skill gems to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Error extracting skill gems:', error.message);

    // Create fallback file with default skills
    const fallbackSkills = [
      {
        id: 'cleave',
        name: 'Cleave',
        description: 'Attacks enemies in a cone, dealing area damage',
        moreDamageMultipliersPct: [20],
        moreAttackSpeedMultipliersPct: [],
        type: 'Attack'
      },
      {
        id: 'heavy-strike',
        name: 'Heavy Strike',
        description: 'A powerful single-target attack',
        moreDamageMultipliersPct: [40],
        moreAttackSpeedMultipliersPct: [],
        type: 'Attack'
      },
      {
        id: 'glacial-cascade',
        name: 'Glacial Cascade',
        description: 'Ice spell that deals cold damage in sequence',
        moreDamageMultipliersPct: [25],
        moreAttackSpeedMultipliersPct: [],
        type: 'Spell'
      },
      {
        id: 'fireball',
        name: 'Fireball',
        description: 'Launches a fiery projectile',
        moreDamageMultipliersPct: [30],
        moreAttackSpeedMultipliersPct: [],
        type: 'Spell'
      },
      {
        id: 'viper-strike',
        name: 'Viper Strike',
        description: 'Fast attack with poison damage',
        moreDamageMultipliersPct: [40],
        moreAttackSpeedMultipliersPct: [10],
        type: 'Attack'
      }
    ];

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fallbackSkills, null, 2));
    console.log(`Created fallback skills file with ${fallbackSkills.length} skills`);
  }
}

main();
