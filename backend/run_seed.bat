@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Running seed_system_tags.py...
C:\Python314\python.exe seed_system_tags.py > seed_output.txt 2>&1
echo Done. Output saved to seed_output.txt
