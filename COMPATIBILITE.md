# Dépendances et intégrations

## CELK 0.3.3.1 (Interface)

| Composant | Prérequis et portée |
| --- | --- |
| **Mode autonome** | FXServer 38435 ou supérieur, build GTA 3889, OneSync, Node 22 fourni par FXServer. Préparation externe vérifiée par FiveM avec Node 24.22.1 sous Windows. |
| **Ensemble livré** | Sadler V01 `9bf8d35c`, pack `sadler-rampe-relevable` 0.1.0. Le lecteur déclare l’identifiant de compatibilité `0.3.3-sadler.1`. |
| **Qbox facultatif** | Adaptateur CELK version 0.3.3, Qbox Core 1.24.1, Vehicles 1.4.2 et Garages 1.1.4. Raccord vérifié en simulation. |
| **LVC facultatif** | Plugin CELK pour LVC 3.2.9 Rev2 et le RageUI de son éditeur. Raccord vérifié en simulation. |
| **Interface ox_lib facultative** | `celk_menu_ox` 0.3.3.1 avec ox_lib 3.42.2. Le panneau J/F6 intégré assure le repli. |
| **F10 facultatif** | Le préparateur fournit `celk_admin`. Accorder l’ACE serveur `celk.admin.packs` et choisir quel menu détient F10. |

Les essais GTA du build Interface et à deux clients restent à faire. [Préversion et téléchargements](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.3.1) · [Installation et ordre de démarrage](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/v0.3.3.1/versions/0.3.3.1/INSTALLATION.md)

## CELK 0.3.2

**État du 18 novembre 2026.** [Installation](versions/0.3.2/INSTALLATION.md) · [Préversion](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.2)

## Runtime et adaptateurs pris en charge

| Composant | Version |
| --- | --- |
| **FiveM autonome** | FXServer **38435**, GTA build **3889**, OneSync, Node **22** fourni par FXServer. Cœur **0.3.2**, identifiant interne `0.3.2-prototype.1`. |
| **Packs de jeu** | Phantom **0.1.0**, Airport Bus **0.5.0**, Kuruma **0.5.0-refonte.2**. |
| **Préparateur de dépôt** | **0.3.2**. Node externe **24.22.1** sous Windows au banc de référence. |
| **Adaptateur Qbox facultatif** | Pour **CELK 0.3.2** avec les ressources officielles Qbox Core **1.24.1**, Vehicles **1.4.2**, Garages **1.1.4**. |
| **Adaptateur LVC facultatif** | Pour **CELK 0.3.2** avec LVC **3.2.9 Rev2** et RageUI éditeur. |

[Cœur CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-script-0.3.2.zip) · [Préparateur de dépôt 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-preparateur-depot-0.3.2.zip) · [Adaptateur Qbox pour CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/10031f68e337d1d560d97d6e95aa7d19c9e345b4/telechargements/CELK-adaptateur-Qbox-pour-0.3.2.zip) · [Adaptateur LVC pour CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/10031f68e337d1d560d97d6e95aa7d19c9e345b4/telechargements/CELK-adaptateur-LVC-pour-0.3.2.zip) · [Empreintes par archive](versions/0.3.2/SHA256SUMS.txt)

Les quatre combinaisons avec et sans Qbox et LVC ont démarré au banc FXServer. Sans Qbox, les commandes passent par ACE. Sans LVC, CELK utilise ses commandes et ses tonalités. Avec le garage Qbox présent et le raccord indisponible, les commandes Qbox restent bloquées côté serveur. [Essais et limites](versions/0.3.2/README.md#essais-et-limites)

## Adapter CELK à son serveur

- **Qbox** · retrouve le montage enregistré dès la sortie du garage officiel. L’adaptateur vérifie l’identité du véhicule et applique les règles de propriété et de métier du profil.
- **LVC** · raccorde la commande des éclats et la sirène sur les véhicules CELK. Avec la paire testée, Q allume les éclats, Alt commande la sirène et Q éteint les deux.
- **Mode autonome** · CELK utilise les permissions ACE et ses commandes intégrées. Les deux ZIP d’adaptateurs sont facultatifs.

Les ZIP publics portent la mention `pour-0.3.2` et conservent les octets qualifiés. Le manifeste de la ressource Qbox et le tag Git historique des adaptateurs conservent leur numéro d’origine. [Fiche des adaptateurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/adaptateurs-v0.3.3)

## Limites de configuration

Le préparateur produit la configuration et le groupe de ressources des packs. Les deux lignes de démarrage globales couvrent le groupe des packs puis le lecteur. Le lecteur accepte jusqu’à **128 modèles**, **32 packs distincts** et **32 Kio de configuration**. Un pack peut être partagé par plusieurs modèles. Un véhicule peut avoir jusqu’à **20 pièces actives**. Ces seuils sont des limites de configuration. La performance sous charge reste à mesurer sur cette préversion.

## Intégrations optionnelles


**État pour CELK 0.3.2** · le parcours public autonome utilise les droits ACE et `celk_bind`. Les essais historiques ci-dessous concernent des copies de développement. La validation d’une intégration publique sera rattachée à la version de CELK et aux versions des ressources réellement testées.

<details>
<summary><strong>Framework et bibliothèques · Qbox et Ox</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Qbox** · `qbx_core`, `qbx_vehicles`, `qbx_garages` | La combinaison officielle épinglée ci-dessus a passé le parcours solo Kuruma Police v2. Le pont applique les droits de propriétaire et de métier configurés. En mode autonome, les droits passent par ACE. Les autres profils de métiers, grades et garages gardent leur propre périmètre d’essai. [Documentation Qbox](https://docs.qbox.re/) |
| **Ox** · `ox_lib`, `oxmysql`, `ox_inventory`, `ox_target` | Ressources à installer selon les exigences des autres scripts de ton serveur. CELK enregistre ses données dans `celk_runtime/local`. [Installation Qbox et prérequis de son profil](https://docs.qbox.re/installation) |

</details>

<details>
<summary><strong>Sirènes et éclairage · Luxart Vehicle Control</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Luxart Vehicle Control (LVC)** | Ressource externe de sirènes et de feux d’urgence. La paire CELK/LVC épinglée a été vérifiée en solo sur la Kuruma Police v2. LVC pilote Q et Alt avec son raccord. CELK conserve F6 pour les variantes et J pour les scènes. En mode autonome, CELK reprend ses commandes et ses tonalités. [Dépôt officiel LVC](https://github.com/TrevorBarns/luxart-vehicle-control) |

</details>

<details>
<summary><strong>Garages, mécanique et scripts tiers sous licence</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **OP Garages V3** | Le scénario de garage a été simulé au labo. Le raccord avec le produit installé reste à vérifier. Le parcours visé est de retrouver le même véhicule à la sortie du garage et de réappliquer son montage CELK en préservant ses propriétés natives. [Documentation OtherPlanet](https://docs.otherplanet.dev/scripts/op-garages-v3/installation) |
| **JG Mechanic** · produit payant | Raccord à qualifier pour la pose ou la dépose du kit depuis une prestation de mécanique. La version du produit et les interfaces utilisées devront figurer dans la preuve. [Installation officielle JG Mechanic](https://docs.jgscripts.com/mechanic/installation) |
| **Radar ou autres scripts tiers** | Produit et versions à confirmer avant un essai de coexistence ou de raccordement. |

Les éditeurs distribuent et documentent leurs ressources séparément. Consulte leurs conditions et dépendances si tu utilises ces scripts. Le parcours autonome 0.3.2 utilise le script et les ensembles choisis sur un serveur FiveM. [Ressources gratuites et payantes sur FiveM](https://docs.fivem.net/docs/server-manual/finding-resources/)

</details>

## Validation et archives

Les essais restent attachés aux versions et parcours du [relevé 0.3.2](versions/0.3.2/README.md). Le multijoueur, la performance sous charge et les autres scripts de garage ou versions tierces restent à qualifier. [Archives](README.md#archives)
