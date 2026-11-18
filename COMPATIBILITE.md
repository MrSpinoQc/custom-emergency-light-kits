# Dépendances et intégrations

**CELK 0.3.1 · état du 18 novembre 2026.** [Installation](versions/0.3.1/INSTALLATION.md) · [Fonctionnalités](FEATURES.md)

## Nécessaire pour CELK 0.3.1

| Élément | Exigence |
| --- | --- |
| **Serveur et client** | FXServer **38435+**, build GTA serveur **3889+**, **OneSync**, client FiveM et GTA V. |
| **Node.js** | **22**, fourni par FXServer selon le manifeste CELK. |
| **Script** | ZIP public **0.3.1**. Version du manifeste **`0.3.0-refonte.3`**. |
| **Phantom** | `celk_pack_phantom` **0.1.0**, ensemble `060a37bf`. |
| **Airport Bus** | `celk_pack_airport_bus_v05` **0.5.0**, ensemble `78be8891`. |
| **Kuruma** | `celk_pack_kuruma_r03` **0.5.0-refonte.2**, ensemble `41340f59`. |
| **Droits FiveM** | `celk.bind` pour lier le véhicule, `celk.fit` pour choisir son montage, `celk.drive` pour commander les feux. |

Démarre les ressources des ensembles choisis avant `celk_runtime`. Le mode autonome utilise FiveM et les modules intégrés de Node.js. Le manifeste `celk_runtime/fxmanifest.lua` se trouve dans le ZIP du script.

## Limites de configuration

Le CFG démarre une ressource par pack distinct utilisé. Les modèles autorisés et les métadonnées des packs se déclarent dans `celk_runtime/local/celk.config.json`. Le lecteur accepte jusqu’à **128 modèles**, **32 packs distincts** et **32 Kio de configuration**. Un pack peut être partagé par plusieurs modèles. Un véhicule peut avoir jusqu’à **20 pièces actives**. Ces seuils sont des limites de configuration. La mesure de performance sous charge est reportée à la 0.3.2.

## Intégrations optionnelles


**État pour CELK 0.3.1** · le parcours public autonome utilise les droits ACE et `celk_bind`. Les essais historiques ci-dessous concernent des copies de développement. La validation d’une intégration publique sera rattachée à la version de CELK et aux versions des ressources réellement testées.

<details>
<summary><strong>Framework et bibliothèques · Qbox et Ox</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Qbox** · `qbx_core`, `qbx_vehicles`, `qbx_garages` | Un profil Qbox a fait l’objet d’essais solo dans le labo sur une autre révision. La qualification du raccord Qbox est reportée à la 0.3.2. Les métiers, grades et véhicules possédés demandent une qualification dédiée. Les droits de la préversion passent par ACE. [Documentation Qbox](https://docs.qbox.re/) |
| **Ox** · `ox_lib`, `oxmysql`, `ox_inventory`, `ox_target` | Ressources à installer selon les exigences des autres scripts de ton serveur. CELK enregistre ses données dans `celk_runtime/local`. [Installation Qbox et prérequis de son profil](https://docs.qbox.re/installation) |

</details>

<details>
<summary><strong>Sirènes et éclairage · Luxart Vehicle Control</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Luxart Vehicle Control (LVC)** | Ressource externe de sirènes et de feux d’urgence. LVC a été utilisé dans un environnement de développement distinct. Le raccord des sirènes et la coexistence des commandes avec CELK 0.3.1 restent à qualifier. Sur la préversion, CELK fournit ses propres touches **F6**, **J** et **Q**, réaffectables dans FiveM. [Dépôt officiel LVC](https://github.com/TrevorBarns/luxart-vehicle-control) |

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

La qualification GTA solo couvre les trois ensembles listés plus haut aux révisions détaillées dans [les notes 0.3.1](versions/0.3.1/README.md#essais-et-limites). Le multijoueur, les performances sous charge et Qbox restent à qualifier en **0.3.2**. Les paires Hellfire et Phantom historiques gardent [leurs guides et préversions](README.md#archives). [Retours multijoueurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)
