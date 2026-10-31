# Saestu Pediatric Anthropometry Benchmark Dataset (`data/`)

Dataset ini dirancang khusus untuk pengujian komparatif metrologi dan computer vision pada sistem pemantauan tumbuh kembang bayi **Saestu**.

## 1. Standar Parameter Kalibrasi Default
Semua gambar dalam dataset ini distandarisasi menggunakan resolusi metrologi **1200 x 896 pixel** dengan orientasi *top-down* (overhead 90 derajat) langsung di atas matras klinis pediatrik polos tanpa gangguan latar belakang (zero infantometer headboard, zero tick marks, zero floor tiles).

- **Default Max Dimension Scale:** `maxDimCm = 100.0 cm`
- **Pixels Per Metric (PPM):** $\text{PPM} = \frac{1200\text{ px}}{100\text{ cm}} = 12.0\text{ px/cm}$
- **Formula Panjang Tubuh:** $\text{TB (cm)} = \frac{\text{Panjang Kontur/Pose (px)}}{\text{PPM}}$

---

## 2. Katalog Sampel Bayi & Ground Truth

| File | Usia Subjek | Deskripsi Visual | TB Target (Ground Truth) | Hasil Siluet Kontur | Hasil MediaPipe Pose | Deviasi Kontur |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`bayi01_newborn_tb49.2cm.jpg`** | 0-1 Bulan (Newborn) | Baju tidur garis pastel, matras vinil sian posyandu | **`49.2 cm`** | **`49.4 cm`** | `38.0 cm` (c: 99.4%) | **+0.2 cm** |
| **`bayi02_2bulan_tb57.4cm.jpg`** | 2 Bulan | Onesie katun kuning pastel, matras sage-mint | **`57.4 cm`** | **`57.2 cm`** | `42.3 cm` (c: 99.0%) | **-0.2 cm** |
| **`bayi03_4bulan_tb61.3cm.jpg`** | 4 Bulan | Onesie katun putih polos, matras hijau-mint | **`61.3 cm`** | **`61.0 cm`** | `50.2 cm` (c: 99.7%) | **-0.3 cm** |
| **`bayi04_7bulan_tb71.5cm.jpg`** | 7 Bulan | Romper *coral-red* cerah, matras biru klinis | **`71.5 cm`** | **`71.3 cm`** | `52.7 cm` (c: 99.5%) | **-0.2 cm** |
| **`bayi05_10bulan_tb78.6cm.jpg`** | 10-12 Bulan | Popok putih, matras vinil sian rumah sakit | **`78.6 cm`** | **`77.2 cm`** | `57.6 cm` (c: 99.4%) | **-1.4 cm** |

---

## 3. Cara Menjalankan Benchmark Uji Coba

Jalankan skrip evaluator melalui CLI di terminal:

```bash
# Uji Metode Siluet Kontur & Morfologi
python C:\dev\saestu-edge\estimate_length.py --image data\bayi01_newborn_tb49.2cm.jpg --method contour_caliper --max-dim-cm 100.0

# Uji Metode MediaPipe Pose (33 Joint Landmark)
python C:\dev\saestu-edge\estimate_length.py --image data\bayi01_newborn_tb49.2cm.jpg --method mediapipe --max-dim-cm 100.0
```

