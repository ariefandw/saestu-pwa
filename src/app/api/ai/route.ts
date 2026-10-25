import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

interface Payload {
  // Tambahkan 'taskType' agar kedepannya rute ini bisa dipakai banyak fitur
  taskType?: string; 
  childName?: string;
  ageInMonths?: number;
  weight?: number;
  height?: number;
  weightStatus?: string;
  lengthStatus?: string;
  masterFoods?: any[];
}

export async function POST(req: Request) {
  try {
    const payload: Payload = await req.json();

    // 1. SYSTEM INSTRUCTION
    // Kunci sukses { type: "json_object" } adalah menyertakan struktur JSON yang kita mau di dalam prompt sistem
    const systemInstructionText = `
      Anda adalah Ahli Gizi Anak dan Dokter Spesialis Anak terkemuka dari Indonesia.
      Tugas Anda adalah memberikan rekomendasi Pemberian Makanan Tambahan (PMT) lokal untuk balita.
      Gunakan HANYA data "Database Makanan Lokal" yang diberikan untuk menyusun menu.
      Selalu gunakan bahasa Indonesia yang ramah, empatik, dan mudah dimengerti oleh Ibu/Orang Tua.
      
      [DISCLAIMER MEDIS WAJIB]
      Pastikan Anda selalu menyertakan pengingat bahwa rekomendasi ini bersifat suportif (bukan pengganti diagnosis dokter). Jika anak mengalami penurunan berat badan drastis, lemas, atau sakit, instruksikan orang tua untuk segera merujuk anak ke fasilitas kesehatan terdekat.
      
      KEMBALIKAN OUTPUT DALAM FORMAT JSON DENGAN STRUKTUR BERIKUT:
      {
        "statusAnalysis": "Penjelasan status gizi (termasuk disclaimer medis)",
        "recommendedFoods": [
          { "foodName": "Nama Bahan", "reason": "Alasan", "portionTip": "Saran porsi" }
        ],
        "recipeSuggestion": {
          "menuName": "Nama Menu",
          "ingredients": ["Bahan 1", "Bahan 2"],
          "instructions": ["Langkah 1", "Langkah 2"]
        },
        "warnings": ["Peringatan 1", "Peringatan 2"]
      }
    `;

    // 2. USER PROMPT
    const promptText = `
      Analisis kondisi balita berikut dan berikan rekomendasi gizi berdasarkan ketersediaan bahan lokal:
      
      [PROFIL ANAK]
      - Nama: ${payload.childName}
      - Usia: ${payload.ageInMonths} Bulan
      - Berat Badan: ${payload.weight} kg (Status: ${payload.weightStatus})
      - Tinggi Badan: ${payload.height} cm (Status: ${payload.lengthStatus})

      [DATABASE MAKANAN LOKAL (Per 100g)]
      ${JSON.stringify(payload.masterFoods?.map(f => ({ name: f.name, protein: f.protein, fat: f.fat, carbs: f.carbs })), null, 2)}

      [INSTRUKSI KETAT]
      1. Jika weightStatus "inadequate" (Faltering/Risiko Stunting), wajib rekomendasikan menu padat kalori dengan Double Protein Hewani (DPH) dan lemak tambahan dari database.
      2. Jika weightStatus "adequate" (Gizi Baik), rekomendasikan menu gizi seimbang biasa.
      3. Hanya rekomendasikan bahan makanan yang ADA di [DATABASE MAKANAN LOKAL] di atas.
    `;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY belum dikonfigurasi di .env" }, { status: 500 });
    }

    const openai = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: apiKey,
    });

    // 3. MENEMBAK API MENGGUNAKAN STANDAR OPENAI
    // Menggunakan Llama 3.3 70B (Generasi terbaru, tercepat, dan bebas error 'decommissioned')
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile", // <-- SUDAH DIPERBARUI DI SINI
      messages: [
        { role: "system", content: systemInstructionText },
        { role: "user", content: promptText }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }, // Memaksa output JSON murni
    });

    const resultText = response.choices[0].message.content;
    
    if (!resultText) {
      throw new Error("Format respons AI kosong atau tidak valid");
    }

    // 4. MENGEMBALIKAN HASIL KE FRONTEND
    return NextResponse.json(JSON.parse(resultText));

  } catch (error: any) {
    console.error("AI Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}