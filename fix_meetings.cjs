const fs = require('fs');
const path1 = 'src/pages/MeetingHome.jsx';
const path2 = 'src/pages/MeetingApp.jsx';

let home = fs.readFileSync(path1, 'utf8');

// 1. fetchMeetings => /api/meetings/history
home = home.replace(/\/api\/meetings\?workspaceId=\$\{workspaceId\}/g, '/api/meetings/history?page=1&limit=20');

// 2. handleStartInstant => POST /api/meetings
home = home.replace(/\/api\/meetings\/register/g, '/api/meetings');

// 3. handleSchedule => POST /api/meetings
home = home.replace(/\/api\/meetings\/create/g, '/api/meetings');

// 4. handleJoin => validate meeting
home = home.replace(
    /\/api\/meeting-logic\/validate\?workspaceId=\$\{finalWorkspaceId\}&roomId=\$\{finalCode\}&password=\$\{finalPwd\}/g,
    '/api/meetings/join/${finalCode}?passcode=${finalPwd}'
);
// Wait, validate returns { room, role }, but old validate returned { valid: true, error: ... }
// I need to change `if (data.valid)` to `if (data.room)`
home = home.replace(/if \(data\.valid\)/g, 'if (data.room || data.id)');

fs.writeFileSync(path1, home);

let app = fs.readFileSync(path2, 'utf8');
app = app.replace("import { Buffer } from 'buffer';\n", "");
app = app.replace("import process from 'process';\n", "");

fs.writeFileSync(path2, app);

console.log('Fixed endpoints and imports');
