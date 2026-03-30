$BASE = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$OUT  = Join-Path $PSScriptRoot "..\public\models"

New-Item -ItemType Directory -Force -Path $OUT | Out-Null

$files = @(
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "face_landmark_68_tiny_model-weights_manifest.json",
  "face_landmark_68_tiny_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2"
)

foreach ($f in $files) {
  $dest = Join-Path $OUT $f
  if (Test-Path $dest) {
    Write-Host "skip: $f"
  } else {
    Write-Host "download: $f"
    Invoke-WebRequest -Uri "$BASE/$f" -OutFile $dest -UseBasicParsing
    Write-Host "done: $f"
  }
}

Write-Host "All models saved to public/models/"
