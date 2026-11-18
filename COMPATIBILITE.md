# Dépendances et intégrations

**CELK 0.3.2 · état du 18 novembre 2026.** [Installation](versions/0.3.2/INSTALLATION.md) · [Préversion](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.2)

## Runtime et adaptateurs pris en charge

| Composant | Version |
| --- | --- |
| **FiveM autonome** | FXServer **38435**, GTA build **3889**, OneSync, Node **22** fourni par FXServer. Cœur **0.3.2**, identifiant interne `0.3.2-prototype.1`. |
| **Packs de jeu** | Phantom **0.1.0**, Airport Bus **0.5.0**, Kuruma **0.5.0-refonte.2**. |
| **Préparateur de dépôt** | **0.3.2**. Node externe **24.22.1** sous Windows au banc de référence. |
| **Adaptateur Qbox facultatif** | CELK **0.3.3** et ressources officielles Qbox Core **1.24.1**, Vehicles **1.4.2**, Garages **1.1.4**. |
| **Adaptateur LVC facultatif** | CELK **0.3.3**, LVC **3.2.9 Rev2** et RageUI éditeur. |

[Cœur CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-script-0.3.2.zip) · [Préparateur de dépôt 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-preparateur-depot-0.3.2.zip) · [Adaptateur Qbox 0.3.3](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-adaptateur-Qbox-0.3.3.zip) · [Adaptateur LVC 0.3.3](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-adaptateur-LVC-0.3.3.zip) · [Empreintes par archive](versions/0.3.2/SHA256SUMS.txt)

Les quatre combinaisons avec et sans Qbox et LVC ont démarré au banc FXServer. Sans Qbox, les commandes passent par ACE. Sans LVC, CELK utilise ses commandes et ses tonalités. Avec le garage Qbox présent et le raccord indisponible, les commandes Qbox restent bloquées côté serveur. [Essais et limites](versions/0.3.2/README.md#essais-et-limites)

## Limites de configuration

Le préparateur produit la configuration et le groupe de ressources des packs. Les deux lignes de démarrage globales couvrent le groupe des packs puis le lecteur. Le lecteur accepte jusqu’à **128 modèles**, **32 packs distincts** et **32 Kio de configuration**. Un pack peut être partagé par plusieurs modèles. Un véhicule peut avoir jusqu’à **20 pièces actives**. Ces seuils sont des limites de configuration. La mesure de performance sous charge est reportée à la 0.3.2.

## Intégrations optionnelles


**État pour CELK 0.3.2** · le parcours public autonome utilise les droits ACE et `celk_bind`. Les essais historiques ci-dessous concernent des copies de développement. La validation d’une intégration publique sera rattachée à la version de CELK et aux versions des ressources réellement testées.

<details>
<summary><strong>Framework et bibliothèques · Qbox et Ox</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Qbox** · `qbx_core`, `qbx_vehicles`, `qbx_garages` | Un profil Qbox a fait l’objet d’essais solo dans le labo sur une autre révision. La qualification couvre la paire documentée ci-dessus. Les métiers, grades et véhicules possédés demandent une qualification dédiée. Les droits de la préversion passent par ACE. [Documentation Qbox](https://docs.qbox.re/) |
| **Ox** · `ox_lib`, `oxmysql`, `ox_inventory`, `ox_target` | Ressources à installer selon les exigences des autres scripts de ton serveur. CELK enregistre ses données dans `celk_runtime/local`. [Installation Qbox et prérequis de son profil](https://docs.qbox.re/installation) |

</details>

<details>
<summary><strong>Sirènes et éclairage · Luxart Vehicle Control</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Luxart Vehicle Control (LVC)** | Ressource externe de sirènes et de feux d’urgence. LVC a été utilisé dans un environnement de développement distinct. Les commandes ont été vérifiées sur la paire CELK/LVC épinglée ci-dessus. Sur la préversion, CELK fournit ses propres touches **F6**, **J** et **Q**, réaffectables dans FiveM. [Dépôt officiel LVC](https://github.com/TrevorBarns/luxart-vehicle-control) |

</details>

<details>
<summary><strong>Garages, mécanique et scripts tiers sous licence</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **OP Garages V3** | Le scénario de garage a été simulé au labo. Le raccord avec le produit installé reste à vérifier. Le parcours visé est de retrouver le même véhicule à la sortie du garage et de réappliquer son montage CELK en préservant ses propriétés natives. [Documentation OtherPlanet](https://docs.otherplanet.dev/scripts/op-garages-v3/installation) |
| **JG Mechanic** · produit payant | Raccord à qualifier pour la pose ou la dépose du kit depuis une prestation de mécanique. La version du produit et les interfaces utilisées devront figurer dans la preuve. [Installation officielle JG Mechanic](https://docs.jgscripts.com/mechanic/installation) |
| **Radar ou autres scripts tiers** | Produit et versions à confirmer avant un essai de coexistence ou de raccordement. |

Les éditeurs distribuent et documentent leurs ressources séparément. Consulte leurs conditions et dépendances si tu utilises ces scripts. Le parcours autonome 0.3.1 utilise le script et les ensembles choisis sur un serveur FiveM. [Ressources gratuites et payantes sur FiveM](https://docs.fivem.net/docs/server-manual/finding-resources/)

</details>

## Validation et archives

Les essais restent attachés aux versions et parcours du [relevé 0.3.2](versions/0.3.2/README.md). Le multijoueur, la performance sous charge et les autres scripts de garage ou versions tierces restent à qualifier. [Archives](README.md#archives)
