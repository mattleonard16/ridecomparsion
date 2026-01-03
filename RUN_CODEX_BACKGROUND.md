# Running Codex with Computer Closed

## Option 1: Using tmux (Recommended)

tmux allows you to detach from a session and reconnect later, even after closing your terminal.

### Setup:
```bash
# Install tmux (if not already installed)
brew install tmux

# Start a new tmux session
tmux new -s codex

# Inside tmux, run your Codex command:
codex exec "your prompt here" 2>/dev/null

# Detach from tmux (keeps running): Press Ctrl+B, then D
# Or run: tmux detach
```

### Reconnect later:
```bash
# List all sessions
tmux ls

# Reattach to the codex session
tmux attach -t codex
```

### Benefits:
- ✅ Process continues even if terminal closes
- ✅ Can reconnect from anywhere (SSH)
- ✅ Multiple sessions possible
- ✅ Easy to detach/reattach

---

## Option 2: Using nohup (Simple)

Runs the process in the background and continues even after terminal closes.

```bash
# Run Codex with nohup (output goes to nohup.out)
nohup codex exec "your prompt here" 2>/dev/null > codex_output.txt &

# Check if it's running
ps aux | grep codex

# View output
tail -f codex_output.txt

# Kill the process if needed
pkill -f "codex exec"
```

### Benefits:
- ✅ Simple, no setup needed
- ✅ Process survives terminal closure
- ⚠️ Harder to interact with later

---

## Option 3: Using screen (Alternative to tmux)

Similar to tmux but older.

```bash
# Start a screen session
screen -S codex

# Run your command
codex exec "your prompt here" 2>/dev/null

# Detach: Press Ctrl+A, then D
# Or: screen -d -m -S codex codex exec "your prompt" 2>/dev/null
```

### Reconnect:
```bash
screen -r codex
```

---

## Option 4: macOS launchd (Service)

For a permanent background service that starts on boot.

### Create a plist file:
```bash
# Create the plist directory if it doesn't exist
mkdir -p ~/Library/LaunchAgents

# Create the service file
cat > ~/Library/LaunchAgents/com.codex.service.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.codex.service</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/codex</string>
        <string>exec</string>
        <string>your prompt here</string>
    </array>
    <key>StandardOutPath</key>
    <string>/tmp/codex.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/codex.error.log</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
EOF

# Load the service
launchctl load ~/Library/LaunchAgents/com.codex.service.plist

# Check status
launchctl list | grep codex

# Unload when done
launchctl unload ~/Library/LaunchAgents/com.codex.service.plist
```

---

## Option 5: Remote Server / VPS

Run Codex on a cloud server that stays online 24/7.

### Popular Options:
- **AWS EC2** (Free tier available)
- **DigitalOcean Droplet** ($5/month)
- **Linode** ($5/month)
- **Google Cloud Run** (Pay per use)

### Setup on remote server:
```bash
# SSH into your server
ssh user@your-server.com

# Install Codex on the server
# (follow Codex installation instructions)

# Use tmux or screen as above
tmux new -s codex
codex exec "your prompt" 2>/dev/null
```

---

## Option 6: Using PM2 (Node.js Process Manager)

If Codex is a Node.js application:

```bash
# Install PM2 globally
npm install -g pm2

# Run Codex with PM2
pm2 start codex --name "codex-task" -- exec "your prompt here" 2>/dev/null

# Monitor
pm2 logs codex-task

# Stop
pm2 stop codex-task
pm2 delete codex-task
```

---

## Recommended Workflow

**For local development:**
1. Use **tmux** - easiest to detach/reattach
2. Keep your Mac awake (System Preferences → Energy Saver → Prevent computer from sleeping)

**For production/long-running:**
1. Use a **remote VPS** with tmux
2. Or use **macOS launchd** for system-level service

**Quick Start (tmux):**
```bash
# Start session
tmux new -s codex

# Run Codex
codex exec "Analyze the codebase and report" 2>/dev/null

# Detach (Ctrl+B, then D)

# Later, reconnect
tmux attach -t codex
```

---

## Notes

- **Computer must stay awake** for local options (tmux/nohup) - they won't survive sleep/shutdown
- **Remote server** is the only true "computer closed" solution
- **Mac sleep settings**: System Preferences → Energy Saver → Prevent computer from sleeping when plugged in
- **SSH access**: If you SSH into your Mac, tmux sessions will persist across SSH connections


