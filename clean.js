const fs = require('fs');
const path = require('path');

const target = process.argv[2] ? process.argv[2].toLowerCase() : 'all';

const folders = ['dist', 'dist-server', 'temp_submissions'];

if (target === 'users' || target === 'user') {
    folders.push(path.join('release', 'Users', 'win-unpacked'));
} else if (target === 'admin') {
    folders.push(path.join('release', 'Admin', 'win-unpacked'));
} else {
    folders.push(path.join('release', 'Users', 'win-unpacked'));
    folders.push(path.join('release', 'Admin', 'win-unpacked'));
}

folders.forEach(folder => {
    const dir = path.join(__dirname, folder);
    if (fs.existsSync(dir)) {
        console.log(`Cleaning: ${folder}...`);
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (err) {
            console.error(`Error deleting ${folder}:`, err.message);
        }
    }
});

console.log("Cleanup complete!");