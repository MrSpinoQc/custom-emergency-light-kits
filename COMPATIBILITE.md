# Dépendances et intégrations

**Custom Emergency Light Kits · par Spino.** Mise à jour du **17 novembre 2026** pour la sortie Hellfire **0.2.0-rc.2-hellfire.5**. [Guide Hellfire](versions/0.2.0-rc.2-hellfire.5/INSTALLATION.md) · [Fonctionnalités](FEATURES.md)

## Combinaisons distribuées

| Montage | Script associé | Qualification |
| --- | --- | --- |
| **Hellfire Police V08** | **0.2.0-rc.2-hellfire.5** avec les ressources V06 0.6.0, V07 0.7.0 et V08 0.8.0 | **5/5 GTA solo** sur les fichiers distribués. |
| **Phantom Grand Format 0.1.0 · notice 2.2** | **0.2.0-rc.1** | Parcours historique et preuves dans son [guide](versions/0.2.0-rc.1/INSTALLATION.md). |

La coexistence du Hellfire et du Phantom historique sous hellfire.5 reste à qualifier en GTA. Chaque parcours ci-dessus identifie sa paire script et pack.

## Nécessaire pour Hellfire

| Élément | Exigence |
| --- | --- |
| **Serveur et client** | Serveur FiveM fonctionnel, GTA V et client FiveM côté joueur. |
| **FXServer** | Artefact **38435+**, avec le moteur **Node.js 22** fourni par FXServer. |
| **GTA côté serveur** | Build **3889+** et **OneSync** actif. |
| **Script CELK** | **0.2.0-rc.2-hellfire.5**. |
| **Ressources du pack** | `celk_pack_hellfire_v06` **0.6.0**, `celk_pack_hellfire_v07` **0.7.0**, `celk_pack_hellfire_v08` **0.8.0**. |
| **Modèle** | `gauntlet4`, Gauntlet Hellfire d’origine dans GTA V. |
| **Permissions ACE** | `celk.bind`, `celk.fit`, `celk.drive`. |

Le parcours autonome utilise les fichiers locaux CELK et les modules intégrés à FiveM et Node.js. Qbox, Ox et Luxart ont leur propre rôle facultatif dans les raccordements ci-dessous. [Manifeste CELK](versions/0.2.0-rc.2-hellfire.5/celk_runtime/fxmanifest.lua) · [Manifeste FiveM](https://docs.fivem.net/docs/scripting-reference/resource-manifest/)

> [!WARNING]
> Démarre les trois ressources de pack avant `celk_runtime`. Copie la configuration Hellfire du guide dans `local/celk.config.json`.

## Intégrations optionnelles

**État pour la préversion publique** · le parcours installé et testé ici utilise les droits ACE et `celk_bind`. Les essais historiques ci-dessous concernent des copies de développement. La validation d’une intégration publique sera rattachée à la version de CELK et aux versions des ressources réellement testées.

<details>
<summary><strong>Framework et bibliothèques · Qbox et Ox</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Qbox** · `qbx_core`, `qbx_vehicles`, `qbx_garages` | Un profil Qbox a fait l’objet d’essais solo dans le labo sur une autre révision. Le raccord public aux métiers, grades et véhicules possédés reste à qualifier. Les droits de la préversion passent par ACE. [Documentation Qbox](https://docs.qbox.re/) |
| **Ox** · `ox_lib`, `oxmysql`, `ox_inventory`, `ox_target` | Ressources à installer selon les exigences des autres scripts de ton serveur. CELK enregistre ses données dans `celk_runtime/local`. [Installation Qbox et prérequis de son profil](https://docs.qbox.re/installation) |

</details>

<details>
<summary><strong>Sirènes et éclairage · Luxart Vehicle Control</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **Luxart Vehicle Control (LVC)** | Ressource externe de sirènes et de feux d’urgence. LVC a été utilisé dans un environnement de développement distinct. Le raccord des sirènes et la coexistence des commandes avec CELK 0.2.0-rc.2-hellfire.5 restent à qualifier. Sur la préversion, CELK fournit ses propres touches **F6**, **J** et **Q**, réaffectables dans FiveM. [Dépôt officiel LVC](https://github.com/TrevorBarns/luxart-vehicle-control) |

</details>

<details>
<summary><strong>Garages, mécanique et scripts tiers sous licence</strong></summary>

| Ressource | État et usage envisagé |
| --- | --- |
| **OP Garages V3** | Le scénario de garage a été simulé au labo. Le raccord avec le produit installé reste à vérifier. Le parcours visé est de retrouver le même véhicule à la sortie du garage et de réappliquer son montage CELK en préservant ses propriétés natives. [Documentation OtherPlanet](https://docs.otherplanet.dev/scripts/op-garages-v3/installation) |
| **JG Mechanic** · produit payant | Raccord à qualifier pour la pose ou la dépose du kit depuis une prestation de mécanique. La version du produit et les interfaces utilisées devront figurer dans la preuve. [Installation officielle JG Mechanic](https://docs.jgscripts.com/mechanic/installation) |
| **Radar ou autres scripts tiers** | Produit et versions à confirmer avant un essai de coexistence ou de raccordement. |

Les éditeurs distribuent et documentent leurs ressources séparément. Consulte leurs conditions et dépendances si tu utilises ces scripts. Le parcours Hellfire de cette préversion fonctionne avec les deux ZIP CELK et le serveur FiveM. [Ressources gratuites et payantes sur FiveM](https://docs.fivem.net/docs/server-manual/finding-resources/)

</details>

## Suivre la compatibilité

La page sera actualisée quand une intégration change de statut. Pour chaque combinaison vérifiée, relève la version de CELK, des packs et du script tiers, l’action testée et le résultat, au banc ou en jeu. **Le multijoueur reste non testé pour 0.2.0-rc.2-hellfire.5.** [Notes de version](CHANGELOG.md) · [Retours multijoueurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)
