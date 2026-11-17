# Dépendances et intégrations

**Custom Emergency Light Kits · par Spino.** Cette page décrit la préversion publique **0.2.0-rc.1**, vérifiée le **16 novembre 2026**. [Guide d’installation](versions/0.2.0-rc.1/INSTALLATION.md) · [Fonctionnalités et suivi](FEATURES.md)

## Nécessaire pour le montage Phantom

| Élément | Exigence pour 0.2.0-rc.1 |
| --- | --- |
| **Serveur et client** | Un serveur FiveM fonctionnel. Côté joueur, GTA V et le client FiveM. |
| **FXServer** | Artefact **38435** ou plus récent. Le manifeste demande le moteur **Node.js 22**, fourni par FXServer. |
| **GTA côté serveur** | Build **3889** ou plus récente et **OneSync** actif. |
| **Script et pack CELK** | Script **0.2.0-rc.1** et **Phantom Grand Format 0.1.0**, en deux ZIP. La livraison de montage Police pour le modèle GTA `phantom` est dans le ZIP du pack. |
| **Accès en jeu** | Les ACE `celk.bind`, `celk.fit` et `celk.drive` donnent les droits de lier un véhicule, choisir un montage et commander les scènes et les éclats. |

Le script public s’installe en mode autonome avec le pack Phantom. Il utilise les modules intégrés à FiveM et à son moteur Node. **Qbox, Luxart/LVC, les bibliothèques Ox, les garages tiers, la base SQL et `npm install` sont dispensables pour ce parcours.** txAdmin est le panneau utilisé dans le guide. Avec un hébergeur, utilise l’équivalent pour le CFG et la console. [Manifeste CELK](versions/0.2.0-rc.1/celk_runtime/fxmanifest.lua) · [Manifeste FiveM](https://docs.fivem.net/docs/scripting-reference/resource-manifest/) · [txAdmin](https://docs.fivem.net/docs/resources/txAdmin/)

> [!WARNING]
> Démarre les ressources des packs requis **avant `celk_runtime`**. Pour Phantom, l’ordre est `ensure celk_pack_phantom`, puis `ensure celk_runtime`.

## Intégrations optionnelles

**État pour la préversion publique** · le parcours installé et testé ici utilise les droits ACE et `celk_bind`. Les essais historiques ci-dessous concernent des copies de développement. La validation d’une intégration publique sera rattachée à la version de CELK et aux versions des ressources réellement testées.

<details>
<summary><strong>Framework et bibliothèques · Qbox et Ox</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Qbox** · `qbx_core`, `qbx_vehicles`, `qbx_garages` | Un profil Qbox a fait l’objet d’essais solo dans le labo sur une autre révision. Le raccord public aux métiers, grades et véhicules possédés reste à qualifier. Les droits de la préversion passent par ACE. [Documentation Qbox](https://docs.qbox.re/) |
| **Ox** · `ox_lib`, `oxmysql`, `ox_inventory`, `ox_target` | Ressources à installer selon les exigences des autres scripts de ton serveur. Pour le montage Phantom, CELK enregistre ses données dans `celk_runtime/local`. [Installation Qbox et prérequis de son profil](https://docs.qbox.re/installation) |

</details>

<details>
<summary><strong>Sirènes et éclairage · Luxart Vehicle Control</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Luxart Vehicle Control (LVC)** | Ressource externe de sirènes et de feux d’urgence. LVC a été utilisé dans un environnement de développement distinct. Le raccord des sirènes et la coexistence des commandes avec CELK 0.2.0-rc.1 restent à qualifier. Sur la préversion, CELK fournit ses propres touches **F6**, **J** et **Q**, réaffectables dans FiveM. [Dépôt officiel LVC](https://github.com/TrevorBarns/luxart-vehicle-control) |

</details>

<details>
<summary><strong>Garages, mécanique et scripts tiers sous licence</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **OP Garages V3** | Le scénario de garage a été simulé au labo. Le raccord avec le produit installé reste à vérifier. Le parcours visé est de retrouver le même véhicule à la sortie du garage et de réappliquer son montage CELK en préservant ses propriétés natives. [Documentation OtherPlanet](https://docs.otherplanet.dev/scripts/op-garages-v3/installation) |
| **JG Mechanic** · produit payant | Raccord à qualifier pour la pose ou la dépose du kit depuis une prestation de mécanique. La version du produit et les interfaces utilisées devront figurer dans la preuve. [Installation officielle JG Mechanic](https://docs.jgscripts.com/mechanic/installation) |
| **Radar ou autres scripts tiers** | Produit et versions à confirmer avant un essai de coexistence ou de raccordement. |

Les éditeurs distribuent et documentent leurs ressources séparément. Consulte leurs conditions et dépendances si tu utilises ces scripts. Le parcours Phantom de cette préversion fonctionne avec les deux ZIP CELK et le serveur FiveM. [Ressources gratuites et payantes sur FiveM](https://docs.fivem.net/docs/server-manual/finding-resources/)

</details>

## Suivre la compatibilité

La page sera actualisée quand une intégration change de statut. Pour chaque combinaison vérifiée, relève la version de CELK, des packs et du script tiers, l’action testée et le résultat, au banc ou en jeu. **Le multijoueur reste non testé pour 0.2.0-rc.1.** [Notes de version](CHANGELOG.md) · [Retours multijoueurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)
