"""Builds tests/fixtures/catalog.json. Product data copied from the Admin API on 2026-10-26.
usage: python3 tests/fixtures/build_catalog.py tests/fixtures/store.json tests/fixtures/catalog.json
"""
import json, sys
SIZES = ["M", "L", "XL", "XXL", "3XL"]
def c(x): return int(round(float(x) * 100))
P = []
def add(handle, title, typ, options, media, variants, created):
    P.append({"handle": handle, "title": title, "type": typ, "created": created, "options": options, "media": media, "variants": variants})

# --- verbatim from the Admin API (2026-10-26) ---
T, F = 1, 0
v = []
for col, m, av in [("olive", 0, {"L"}), ("Genzari", 2, {"M","L","XL","XXL","3XL"}), ("coffe", 5, {"L","XL"}), ("Green", 3, set())]:
    for s in (SIZES if col != "olive" else ["M","L","XL","XXL"]):
        v.append([[col, s, "Linen"], c(299 if s=="3XL" else 249), c(400 if s=="3XL" else 350), T if s in av else F, m])
add("linen-maxi-skirt-with-front-pockets", "Linen Skirt with Front Pockets | جيبة كتان بجيوب أمامية", "Skirt",
    [{"name":"Color","values":[["olive","#736416"],["Genzari","#0E7F8B"],["coffe","#a7752e"],["Green","#05AA3D"]]},{"name":"Size","values":SIZES},{"name":"Fabric","values":["Linen"]}],
    [[1024,1536],[810,1080],[810,1080],[810,1080],[1024,1536],[1024,1536]], v, 20)

v = []
for col, m, av in [("Genzari", 1, set()), ("Black", 2, {"M"}), ("Beige", 0, {"XL"})]:
    for s in SIZES:
        v.append([[col, s, "Linen"], c(249), c(499 if s=="3XL" else 449), T if s in av else F, m])
add("long-linen-shirt", "Long Linen Shirt Dress | قميص كتان طويل", "Dress",
    [{"name":"Color","values":[["Genzari","#0E7F8B"],["Black","#000000","black-swatch"],["Beige","#EAD8AB"]]},{"name":"Size","values":SIZES},{"name":"Fabric","values":["Linen"]}],
    [[2716,3874],[896,1200],[1024,1536],[1024,1536],[2642,3522],[2505,3340],[3024,4032],[3024,4032]], v, 19)

v = []
for col, m, p, cp in [("Black",0,599,680),("Genzari",1,573,888),("Beige",2,573,888),("coffe",3,573,888)]:
    for s in SIZES:
        v.append([[col, "Linen", s], c(p+50 if s=="3XL" else p), c(cp+50 if (s=="3XL" and col=="Black") else cp), F, m])
add("linen-suit", "طقم كتان بياقة صيني | Linen Two-Piece Suit with Mandarin Collar", "Sets",
    [{"name":"Color","values":[["Black","#000000","black-swatch"],["Genzari","#0E7F8B"],["Beige","#EAD8AB"],["coffe","#a7752e"]]},{"name":"Fabric","values":["Linen"]},{"name":"Size","values":SIZES}],
    [[1024,1536]]*4, v, 18)

v = []
for col, m in [("Pink",0),("White",1)]:
    for s in SIZES:
        v.append([[col, s, "Linen"], c(839 if s=="3XL" else 789), c(928), T, m])
add("linen-pajama-set", "Linen Pajama Set", "Home Wear",
    [{"name":"Color","values":[["Pink","#FFC0CB"],["White","#FFFFFF"]]},{"name":"Size","values":SIZES},{"name":"Fabric","values":["Linen"]}],
    [[1086,1448],[1086,1448],[829,1448]], v, 17)

v = []
for col, m in [("black",0),("marron",1)]:
    for i, s in enumerate(["M","L","XL","XXL"]):
        v.append([[col, s], c(793), c(943.67), T, m if i == 0 else None])
add("471", "Linen blouse", "Blouse", [{"name":"Color","values":[["black"],["marron"]]},{"name":"Size","values":["M","L","XL","XXL"]}],
    [[810,1080],[810,1080]], v, 16)

v = []
for s in SIZES: v.append([["Black","Linen",s], c(814 if s=="3XL" else 764), c(860.37 if s=="M" else 843), T, 0])
for s in SIZES: v.append([["Genzari","Linen",s], c(814 if s=="3XL" else 764), c(860.37 if s=="M" else 843), F, 1])
add("476", "Linen blouse", "Blouse",
    [{"name":"Color","values":[["Black","#000000","black-swatch"],["Genzari","#0E7F8B"]]},{"name":"Fabric","values":["Linen"]},{"name":"SIZE","values":SIZES}],
    [[1024,1536],[811,1080]], v, 15)

def single(handle, title, typ, color, sizes, media, price, cp, created, price3=None, fabric=False):
    vv = []
    for i, s in enumerate(sizes):
        p = price3 if (price3 and s == "3XL") else price
        vv.append([[color, s] + (["Linen"] if fabric else []), c(p), c(cp), T, 0 if i == 0 else None])
    opts = [{"name":"Color","values":[[color]]},{"name":"Size","values":sizes}] + ([{"name":"Fabric","values":["Linen"]}] if fabric else [])
    add(handle, title, typ, opts, media, vv, created)

single("510", "Havan Linen Blouse", "Blouse", "dark beige", SIZES, [[750,1000]], 723, 860.37, 14)
single("381", "Linen dress", "Dress", "powder blue", ["L","XL","XXL","M","3XL"], [[810,1080]], 808, 929.20, 13)
single("488", "Navy Breeze Linen Blouse", "Blouse", "navy", ["M","L","XL","3XL","XXL"], [[738,1080]], 723, 860.37, 12)
single("white-pinstriped-linen-suit-in-black", "Grey Pinstripe linen Suit", "Sets", "Striped", SIZES, [[1931,2854],[2458,2838],[2068,3034],[2010,3133]], 1321, 1388, 11, price3=1371, fabric=True)
single("white-striped-linen-dress", "White Striped Linen Dress", "Dress", "Striped", SIZES, [[1023,1537]], 1490, 1566, 10, price3=1540, fabric=True)

# --- derived from tests/fixtures/store.json (title, price, stock, photo size): one colour, sizes M-3XL ---
store = json.load(open(sys.argv[1]))
for i, p in enumerate(store["products"]):
    vv = [[["Default", s], p["price_max"] if s == "3XL" else p["price"], p["compare_at"], T if p["inventory"] > 0 else F, 0 if k == 0 else None] for k, s in enumerate(SIZES)]
    add(p["handle"], p["title"], "Skirt", [{"name":"Color","values":[["Default"]]},{"name":"Size","values":SIZES}], [list(p["image"]), [p["image"][0], p["image"][1]]], vv, 9 - i)

FACTS = {
  "476": {"fabric": ["Linen"]},
  "linen-maxi-skirt-with-front-pockets": {"fabric": ["Linen"], "skirt-dress-length-type": ["Maxi"]},
  "long-linen-shirt": {"skirt-dress-length-type": ["Maxi"], "sleeve-length-type": ["Long"], "fabric": ["Linen"]},
  "linen-suit": {"skirt-dress-length-type": ["Maxi"], "fabric": ["Linen"]},
  "linen-pajama-set": {"sleeve-length-type": ["Long"], "top-length-type": ["Medium"], "fabric": ["Linen"]},
}
for p in P:
    if p["handle"] in FACTS: p["facts"] = FACTS[p["handle"]]
P[0]["description"] = "<p>Test description, not the real product copy.</p>"

out = {
  "_source": "Products 1-11: options, swatch colours, variant prices, stock, photo sizes and category metafields (facts) copied from the store's Admin API on 2026-10-26 (read-only). Products 12-20: titles, prices, stock and photo sizes from tests/fixtures/store.json, with sizes M-3XL added. Collections are built from these in tests/lib/theme-harness.js. Test data only; the theme never reads it.",
  "products": P,
  "collections": {
    "skirts": {"title": "Skirts", "size": 152, "description": ""},
    "home-wear": {"title": "Home Wear", "size": 22, "description": "<p>قطع الهوم وير من درسر — لبس بيتي ناعم ومريح لراحتك الخاصة في البيت. خامات قطنية بتتنفس، قصّات واسعة، وأطقم سهلة وعملية للنوم والقعدة في البيت.</p><p>Dressar's homewear collection — soft, comfortable pieces made for your private comfort at home. Breathable cotton, relaxed cuts, and easy sets for lounging and sleepwear.</p><hr><p><strong>⚠️ ملابس الهوم وير: لا يوجد استبدال أو استرجاع</strong><br>لأسباب صحية، كل قطع الهوم وير وملابس النوم غير قابلة للاستبدال أو الاسترجاع نهائيًا. من حقك <strong>المعاينة فقط</strong> قدام المندوب قبل الاستلام — تقدري تشوفي القطعة وتتأكدي من المقاس واللون قبل ما تدفعي.<br><em>Homewear is non-returnable and non-exchangeable for hygiene reasons. Inspection on delivery is permitted before payment.</em><br>للاستفسار قبل الطلب: واتساب <strong>01020676173</strong></p>"},
    "pants": {"title": "Pants", "size": 5, "description": "<p>Short description.</p>"},
    "empty": {"title": "Empty", "size": 0, "description": ""}
  }
}
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
print(len(P), "products")
