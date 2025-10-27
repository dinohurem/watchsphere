from PIL import Image, ImageDraw, ImageFont

# Create icon (1024x1024)
icon = Image.new('RGB', (1024, 1024), color='#1C1C1E')
draw = ImageDraw.Draw(icon)
draw.text((512, 512), "WS", fill='white', anchor='mm', font=None)
icon.save('icon.png')

# Create splash (1284x2778 - iPhone 14 Pro Max)
splash = Image.new('RGB', (1284, 2778), color='#1A1A1A')
draw = ImageDraw.Draw(splash)
draw.text((642, 1389), "WatchSphere", fill='white', anchor='mm', font=None)
splash.save('splash.png')

# Create adaptive icon (1024x1024)
adaptive = Image.new('RGB', (1024, 1024), color='#1C1C1E')
draw = ImageDraw.Draw(adaptive)
draw.text((512, 512), "WS", fill='white', anchor='mm', font=None)
adaptive.save('adaptive-icon.png')

# Create favicon (48x48)
favicon = Image.new('RGB', (48, 48), color='#1C1C1E')
draw = ImageDraw.Draw(favicon)
draw.text((24, 24), "W", fill='white', anchor='mm', font=None)
favicon.save('favicon.png')

print("Placeholder images created successfully!")
