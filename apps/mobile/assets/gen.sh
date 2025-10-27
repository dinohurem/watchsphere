#!/bin/bash
# Create simple base64 encoded PNGs

# 1024x1024 black square (icon)
base64 -d > icon.png << 'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
EOF

# Copy for other files
cp icon.png splash.png
cp icon.png adaptive-icon.png
cp icon.png favicon.png

echo "Created placeholder images"
ls -lh
