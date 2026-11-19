# CELK 0.3.2 · Préversion FiveM

**Par Spino.** [Cœur CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-script-0.3.2.zip) · [Préparateur de dépôt 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-preparateur-depot-0.3.2.zip) · [Guide](INSTALLATION.md) · [Empreintes SHA-256](SHA256SUMS.txt)

**Packs JEU** · [Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-phantom-060a37bf.zip) · [Airport Bus](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-airbus-78be8891.zip) · [Kuruma](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-kuruma-41340f59.zip)

**Adaptateurs facultatifs** · [Adaptateur Qbox pour CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/10031f68e337d1d560d97d6e95aa7d19c9e345b4/telechargements/CELK-adaptateur-Qbox-pour-0.3.2.zip) · [Adaptateur LVC pour CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/10031f68e337d1d560d97d6e95aa7d19c9e345b4/telechargements/CELK-adaptateur-LVC-pour-0.3.2.zip) · [Préversion adaptateurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/adaptateurs-v0.3.3)

Le cœur dans le ZIP s’identifie comme `0.3.2-prototype.1`. Les deux ZIP facultatifs sont nommés d’après la version de CELK qu’ils accompagnent. Les archives Qbox et LVC sont distribuées par leurs éditeurs.

## Essais et limites

- Le préparateur permet de passer d’un ensemble à trois sans ajouter d’entrée de pack au CFG. La génération reste identique si les entrées restent identiques.
- Les trois ensembles se chargent sur les quatre combinaisons FXServer avec et sans Qbox et LVC. Le banc couvre le repli et les droits, sans client connecté.
- En GTA solo sur la paire distribuée, Julien a validé la Kuruma Police v2 avec le garage Qbox officiel et LVC 3.2.9 Rev2. Q allume sans roue radio, Alt commande la sirène et Q coupe les deux effets. Au retour du garage, les sept pièces sont déjà posées et les feux restent éteints.
- Les mesures de performance sous charge, la synchronisation multijoueur et les autres versions de Qbox ou LVC demandent leur propre qualification. L’Airport Bus a des contrôles solo historiques sur la 0.3.1 et un chargement sur le banc exact 0.3.2.

Le banc solo utilisait le garage officiel avec `doorsLocked = false` sur le profil sans clés. Les essais archivés du Phantom et du Bus gardent leurs configurations d’origine.

[Compatibilité et versions éditeur](../../COMPATIBILITE.md) · [Téléchargements historiques](../../README.md#archives)

## Référence de la chaîne de production

[Studio → Atelier → FiveM : formats publics, versions figées et contrôles](CHAINE-COMPILATION.md). Le profil autonome Studio → Atelier reste à spécifier publiquement; il ne doit pas être confondu avec un pack JEU.
