/**
 * 🧠 ArogyaPlus - AI Memory CLI Assistant
 * Usage:
 *   node .memory/memory.js status           - High-level overview & project health
 *   node .memory/memory.js backlog          - View completed, in-progress, & pending features
 *   node .memory/memory.js commits          - View git commit & push history
 *   node .memory/memory.js search <term>    - Instant search across routes, models, decisions & backlog
 *   node .memory/memory.js add-commit --sha <sha> --msg <msg> - Log a new commit to memory.json
 *   node .memory/memory.js complete-task --id <id>            - Mark a backlog feature as completed
 */

const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'memory.json');

function loadMemory() {
  try {
    const data = fs.readFileSync(MEMORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Failed to load memory.json:', err.message);
    process.exit(1);
  }
}

function saveMemory(memory) {
  try {
    memory.last_updated = new Date().toISOString();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
    console.log('✅ Memory saved successfully.');
  } catch (err) {
    console.error('❌ Failed to save memory.json:', err.message);
  }
}

const args = process.argv.slice(2);
const command = args[0] ? args[0].toLowerCase() : 'status';

const memory = loadMemory();

switch (command) {
  case 'status':
  case 'overview': {
    console.log('====================================================');
    console.log(`🏥 Project: ${memory.project.name} (${memory.project.title})`);
    console.log(`📌 Tech Stack: Express, MongoDB, Socket.IO, WebPush, Razorpay`);
    console.log(`📅 Last Updated: ${memory.last_updated}`);
    console.log('====================================================');
    console.log(`✅ Completed Features: ${memory.backlog.completed.length}`);
    console.log(`🔄 In-Progress Tasks:  ${memory.backlog.in_progress.length}`);
    console.log(`🚀 Pending Backlog:    ${memory.backlog.pending.length}`);
    console.log(`📜 Recent Commits:     ${memory.git_history.recent_commits.length}`);
    console.log('====================================================');
    console.log('💡 Run "node .memory/memory.js backlog" to view feature roadmap.');
    break;
  }

  case 'backlog':
  case 'roadmap': {
    console.log('\n--- ✅ COMPLETED FEATURES ---');
    memory.backlog.completed.forEach(f => console.log(`  [${f.id}] (${f.category}) ${f.name}`));

    console.log('\n--- 🔄 IN PROGRESS ---');
    memory.backlog.in_progress.forEach(f => console.log(`  [${f.id}] (${f.category}) ${f.name}`));

    console.log('\n--- 🚀 PENDING BACKLOG ---');
    memory.backlog.pending.forEach(f => console.log(`  [${f.id}] [${f.priority}] (${f.category}) ${f.name}\n      ➜ ${f.description}`));
    break;
  }

  case 'commits':
  case 'git': {
    console.log('\n--- 📜 RECENT GIT COMMITS ---');
    memory.git_history.recent_commits.forEach(c => {
      console.log(`  🔹 Commit ${c.sha} (${c.date}) by ${c.author}`);
      console.log(`     Message: ${c.message}`);
      if (c.files_changed) console.log(`     Files: ${c.files_changed.join(', ')}`);
      console.log('');
    });
    break;
  }

  case 'search': {
    const query = args[1] ? args[1].toLowerCase() : '';
    if (!query) {
      console.log('Usage: node .memory/memory.js search <keyword>');
      break;
    }
    console.log(`\n🔍 Searching memory for: "${query}"...\n`);

    // Search routes
    const routes = memory.architecture.routes.filter(r => r.path.toLowerCase().includes(query) || r.desc.toLowerCase().includes(query));
    if (routes.length > 0) {
      console.log('📌 Matching Routes:');
      routes.forEach(r => console.log(`  - ${r.path} (${r.file}): ${r.desc}`));
    }

    // Search models
    const models = memory.architecture.models.filter(m => m.name.toLowerCase().includes(query) || m.file.toLowerCase().includes(query));
    if (models.length > 0) {
      console.log('📌 Matching Models:');
      models.forEach(m => console.log(`  - ${m.name} (${m.file})`));
    }

    // Search backlog
    const backlogMatches = [...memory.backlog.completed, ...memory.backlog.in_progress, ...memory.backlog.pending]
      .filter(b => b.name.toLowerCase().includes(query) || (b.description && b.description.toLowerCase().includes(query)));
    if (backlogMatches.length > 0) {
      console.log('📌 Matching Backlog Items:');
      backlogMatches.forEach(b => console.log(`  - [${b.id}] ${b.name}`));
    }
    break;
  }

  case 'add-commit': {
    const shaIndex = args.indexOf('--sha');
    const msgIndex = args.indexOf('--msg');
    const sha = shaIndex !== -1 ? args[shaIndex + 1] : 'HEAD';
    const msg = msgIndex !== -1 ? args[msgIndex + 1] : 'Update';

    const newCommit = {
      sha,
      date: new Date().toISOString().split('T')[0],
      message: msg,
      author: 'AI-Assistant'
    };

    memory.git_history.recent_commits.unshift(newCommit);
    saveMemory(memory);
    console.log(`➕ Added commit ${sha} to memory.`);
    break;
  }

  default: {
    console.log('Available Commands: status, backlog, commits, search <term>, add-commit --sha <sha> --msg <msg>');
    break;
  }
}
