# Custom Emergency Light Kits

**Des feux d’urgence configurables pour FiveM, par Spino.** Choisis un montage, change de scène lumineuse et retrouve les réglages sauvegardés sur ton véhicule.

[Installer le Hellfire](versions/0.2.0-rc.2-hellfire.5/INSTALLATION.md) · [Dépendances et intégrations](COMPATIBILITE.md) · [Catalogue](PACKS.md) · [Fonctionnalités et suivi](FEATURES.md) · [Préversion GitHub](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.2.0-rc.2-hellfire.5)

## Téléchargements

**Nouvelle préversion · CELK 0.2.0-rc.2-hellfire.5 avec Hellfire Police V08.** Télécharge le script et le pack séparément.

| Fichier | Contenu | Lien direct |
| --- | --- | --- |
| Script CELK **0.2.0-rc.2-hellfire.5** | Runtime qualifié en solo avec le Hellfire | [Télécharger le script](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/01a52dbff9574908095e3f96c431b27872746437/telechargements/CELK-script-0.2.0-rc.2-hellfire.5.zip) |
| Pack **Hellfire Police V08** | Montage de 15 pièces et ressources Hellfire V06, V07 et V08 | [Télécharger le pack](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/01a52dbff9574908095e3f96c431b27872746437/telechargements/CELK-pack-Hellfire-personnel-fddf5f43.zip) |

[Guide pas à pas](versions/0.2.0-rc.2-hellfire.5/INSTALLATION.md) · [SHA-256 des deux ZIP](versions/0.2.0-rc.2-hellfire.5/SHA256SUMS.txt) · [Notes de version](versions/0.2.0-rc.2-hellfire.5/README.md)

> [!IMPORTANT]
> **Essentiel pour l’installation** · un serveur FiveM opérationnel, FXServer **38435+**, GTA build serveur **3889+**, **OneSync** et les deux ZIP. Le moteur Node.js **22** est fourni par FXServer. Le parcours CELK utilise les permissions ACE.

> [!WARNING]
> Démarre les trois ressources Hellfire **avant `celk_runtime`**. L’ordre et la configuration complète sont dans le guide.

## Premier démarrage

1. Copie les ressources Hellfire et le script dans la bonne instance FiveM.
2. Place l’ensemble dans `celk_runtime/local/install-sets`, puis copie la configuration Hellfire et règle les droits ACE.
3. Lance `celk_preflight_set`, puis `celk_install_set` avec l’empreinte du plan affichée. Après le redémarrage prévu de CELK, consulte `celk_status`.
4. Au volant du Gauntlet Hellfire, lie le véhicule avec `celk_bind`. **F6** choisit le montage, **J** ouvre les scènes et les commandes de projecteurs, **Q** commande les éclats.

[Installation complète](versions/0.2.0-rc.2-hellfire.5/INSTALLATION.md) · [Dépannage](versions/0.2.0-rc.2-hellfire.5/INSTALLATION.md#dépannage)

## Hellfire Police V08

Le montage réunit une rampe V08, les feux V07 et deux projecteurs V06. Il propose **15 poses**, une scène **Double alternance de 50 pistes** et deux têtes orientables. **5/5 contrôles GTA solo** sont validés sur les fichiers distribués. Le multijoueur reste non testé. [Fiche du pack](PACKS.md#hellfire-police-v08)

![Optiques Hellfire sur un établi dans un garage mécanique](images/hellfire-police-v08-garage.png)

*Optiques Hellfire conçues par Spino. Rendu des modèles 3D de production avec finition d’ambiance générative.*

<details>
<summary><strong>Voir le montage sur le Hellfire · aperçu Atelier R02</strong></summary>

![Hellfire équipé de 15 pièces, aperçu 3D dans l’Atelier R02](images/hellfire-v08-placement-atelier-r02.png)

*Capture existante de l’aperçu 3D Atelier R02, en trois-quarts avant. Les 15 pièces, leurs poses et les réglages du montage correspondent au fichier distribué. Phase lumineuse non consignée.*

[Provenance de la capture](images/hellfire-police-v08-provenance.md#aperçu-de-placement-atelier-r02)

</details>

<details>
<summary><strong>Captures en jeu à ajouter</strong></summary>

| Emplacement | Capture à prendre |
| --- | --- |
| 📷 **PHOTO À AJOUTER · Montage complet** | Gauntlet Hellfire en trois-quarts avant, véhicule entier et feux éteints. Montrer la rampe, les optiques et leurs appuis. |
| 📷 **PHOTO À AJOUTER · Scène allumée** | Trois-quarts arrière pendant Double alternance, puis une vue latérale. Conserver le nom de la scène pour la légende. |
| 📷 **PHOTO À AJOUTER · Projecteurs** | Montrer les deux têtes J à une position lisible avec les socles et le dégagement des faisceaux. |
| 📷 **PHOTO À AJOUTER · Menu F6** | Véhicule à l’arrêt, montage sélectionné visible et nom de la variante lisible. |

</details>

<details>
<summary><strong>Qbox, Luxart et autres scripts</strong></summary>

CELK s’installe en mode autonome. **Qbox, Luxart Vehicle Control, Ox et les scripts de garage ou de mécanique** ont leur propre installation. Leur raccord avec cette préversion doit être qualifié pour les versions utilisées. [État des intégrations](COMPATIBILITE.md#intégrations-optionnelles)

</details>

## Phantom Grand Format historique

Le pack public **Phantom Grand Format 0.1.0**, notice 2.2, conserve son montage de 14 pièces et ses cinq scènes avec le parcours documenté sur **CELK 0.2.0-rc.1**. [Téléchargements et guide Phantom](versions/0.2.0-rc.1/README.md) · [Fiche du pack](PACKS.md#phantom-grand-format--010)

![Les quatre optiques Phantom allumées sur un établi dans un garage mécanique](download.png)

*Visuel de présentation des optiques conçues par Spino. La texture et la teinte du métal illustrent la scène.*

## Fonctionnalités et suivi

Le runtime accepte **128 modèles configurés**, **32 packs** et **20 pièces actives par véhicule** au maximum. Les essais de performance à ces volumes restent à faire. Les accès métier, le catalogue en jeu et les essais à deux clients sont suivis en phase 3. [Fonctionnalités](FEATURES.md) · [Notes de version](CHANGELOG.md) · [Retours multijoueurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)

<details>
<summary><strong>Soutenir le développement</strong></summary>

Un **Patreon est envisagé** pour partager des nouvelles de développement plus régulières. La formule, le rythme et les éventuels avantages restent à définir. Tout projet d’accès payant à des packs ou à des téléchargements sera évalué selon les droits sur les fichiers et les règles de FiveM. Les annonces de versions sont publiées dans le suivi GitHub. [Conditions FiveM](https://fivem.net/terms) · [Documentation Cfx sur les ressources payantes](https://docs.fivem.net/docs/server-manual/finding-resources/)

Les conditions de partage et la licence de CELK restent à définir.

</details>

## Archives

<details>
<summary><strong>CELK 0.1.2 · Première revue publique</strong></summary>

Le script 0.1.2 couvrait le montage Phantom Police. [ZIP d’origine](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/main/telechargements/CELK-script-0.1.2-candidat.zip) · [Guide 0.1.2](INSTALLATION-0.1.2.md) · [Code 0.1.2](celk_runtime) · [Empreintes d’origine](telechargements/SHA256SUMS.txt)

</details>
