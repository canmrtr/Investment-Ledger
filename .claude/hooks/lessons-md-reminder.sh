#!/bin/bash
# SessionStart hook: inject the Lessons.md rule into Claude's context.

cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "LESSONS.MD KURALI (zorunlu):\n1. Session basinda Lessons.md'yi oku. Gecmis duzeltmelere uy.\n2. Kullanici seni duzelttiginde, itiraz ettiginde veya 'tekrar kontrol et' dediginde: ONCE onun konusunu cozmeye odaklan.\n3. Konu cozuldukten SONRA mutlaka sor: 'Bunu Lessons.md'ye ekleyelim mi?'\n4. ASLA Lessons.md'ye kendi insiyatifinle ekleme yapma. Her zaman onay al.\n5. Kullanici 'evet/ekle' derse: yeni entry'yi en uste, formatla (### TARIH - Baslik / Baglam / Hatam / Dogrusu / Kural) yaz. Tekrar eden mesele varsa eski entry'yi guncelle.\n6. Kullanici 'hayir' derse: ekleme yapma, konuyu kapat."
  }
}
JSON
