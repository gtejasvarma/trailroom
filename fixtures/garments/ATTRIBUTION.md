# Garment images: attribution

The VITON-HD garment images (the `vitonhd-*` files in `../manifest.json`) come from the **VITON-HD** dataset,
test split, `test/cloth/`, unmodified. They are not committed to this repo.

> Seunghwan Choi, Sunghyun Park, Minsoo Lee, Jaegul Choo. _VITON-HD: High-Resolution Virtual
> Try-On via Misalignment-Aware Normalization._ CVPR 2021. https://arxiv.org/abs/2103.16874

Licence: Creative Commons BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).
Source: https://github.com/shadow2496/VITON-HD. Terms of use for this project are in
`docs/decisions/0002-eval-fixture-sources.md`.

To re-fetch without downloading the whole 4.5 GB zip: the Drive file supports HTTP range requests,
so a range-reading zip client (e.g. Python `remotezip`) can pull just the `test/cloth/<id>_00.jpg`
entries named in the manifest.

## Wikimedia Commons garments

Resized to at most 1920 px, and, for transparent PNGs, flattened onto white. `commons-jeans.jpg`
also had its museum caption strip cropped off. No other changes. Licences as listed. CC BY and
CC BY-SA require this credit; CC BY-SA also requires derivatives (renders) to carry the same
licence if they are ever distributed, which they aren't (ADR 0002).

| File | Source | Author | Licence |
| ---- | ------ | ------ | ------- |
| `commons-elbow-sweater.jpg` | [Polo Ralph Lauren Gun Patch Sweater (13973497074).jpg](https://commons.wikimedia.org/wiki/File:Polo_Ralph_Lauren_Gun_Patch_Sweater_(13973497074).jpg) | Robert Sheie | CC BY 2.0 |
| `commons-plaid-shirt.jpg` | [Madraskarohemd Sir Oliver.jpg](https://commons.wikimedia.org/wiki/File:Madraskarohemd_Sir_Oliver.jpg) | Labegola | CC BY-SA 3.0 |
| `commons-jeans.jpg` | [Jeans Gul&Blå i modellen Dallas.jpg](https://commons.wikimedia.org/wiki/File:Jeans_Gul%26Bl%C3%A5_i_modellen_Dallas.jpg) | Eriksson Elisabeth | CC BY-SA 4.0 |
| `commons-tailored-trousers.jpg` | [Rechte pantalon van donkerblauwe keper van herenuniform Leger des Heils, objectnr 65680-2.JPG](https://commons.wikimedia.org/wiki/File:Rechte_pantalon_van_donkerblauwe_keper_van_herenuniform_Leger_des_Heils,_objectnr_65680-2.JPG) | Museum Rotterdam | CC BY-SA 3.0 |
| `commons-leopard-trousers.jpg` | [Motyw zwierzęcy.jpeg](https://commons.wikimedia.org/wiki/File:Motyw_zwierz%C4%99cy.jpeg) | Damian 9624 | CC BY-SA 4.0 |
| `commons-track-pants.jpg` | [Trainingpants.jpg](https://commons.wikimedia.org/wiki/File:Trainingpants.jpg) | Kuha455405 | CC BY-SA 3.0 |
| `commons-satin-dress.jpg` | [Satin Blue Dress.jpg](https://commons.wikimedia.org/wiki/File:Satin_Blue_Dress.jpg) | Tibald | CC BY-SA 3.0 |
| `commons-belted-dress.jpg` | [Rechte damesjapon (1) van donkergroene stof, driekwartmouwen en losse ceintuur (2) van dezelfde stof met opgenaaid wit band, zelfmaakmode naar knippatroon “Regina 4443.3”, objectnr 81082-1-2.JPG](https://commons.wikimedia.org/wiki/File:Rechte_damesjapon_(1)_van_donkergroene_stof,_driekwartmouwen_en_losse_ceintuur_(2)_van_dezelfde_stof_met_opgenaaid_wit_band,_zelfmaakmode_naar_knippatroon_%E2%80%9CRegina_4443.3%E2%80%9D,_objectnr_81082-1-2.JPG) | A. Hennekes | CC BY-SA 3.0 |
| `commons-stripe-dress.jpg` | [Rechte japon gebreid in tricot in horizontale banen zwart, grijs en felroze, hoge boord en korte mouwen, “La Boutique de Sophie”, objectnr 25165.JPG](https://commons.wikimedia.org/wiki/File:Rechte_japon_gebreid_in_tricot_in_horizontale_banen_zwart,_grijs_en_felroze,_hoge_boord_en_korte_mouwen,_%E2%80%9CLa_Boutique_de_Sophie%E2%80%9D,_objectnr_25165.JPG) | Museum Rotterdam | CC BY-SA 3.0 |
| `commons-shell-jacket.jpg` | [Windbreaker Jacket, Hood Outside Transparency.png](https://commons.wikimedia.org/wiki/File:Windbreaker_Jacket,_Hood_Outside_Transparency.png) | Ingolfson | CC0 |
| `commons-windbreaker.jpg` | [Windjack - Windbreaker.jpg](https://commons.wikimedia.org/wiki/File:Windjack_-_Windbreaker.jpg) | Ridderspoor | CC BY-SA 4.0 |
| `commons-denim-jacket.jpg` | [1980s blue denim jacket, Finland – 01.jpg](https://commons.wikimedia.org/wiki/File:1980s_blue_denim_jacket,_Finland_%E2%80%93_01.jpg) | Etelä-Karjalan museo | CC BY 4.0 |
| `commons-parka.jpg` | [DustyRoyParka.jpg](https://commons.wikimedia.org/wiki/File:DustyRoyParka.jpg) | Dusty Roy | Public domain |
| `commons-leather-coat.jpg` | [Black Leather Coat of Charles A. Lindbergh - DPLA - eec840e73527f044387d2568bbdb7f20 (page 1).jpg](https://commons.wikimedia.org/wiki/File:Black_Leather_Coat_of_Charles_A._Lindbergh_-_DPLA_-_eec840e73527f044387d2568bbdb7f20_(page_1).jpg) | Spalding | Public domain |
