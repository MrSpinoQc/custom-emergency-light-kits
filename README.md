# Custom Emergency Light Kits

**Des feux d’urgence configurables pour FiveM, par Spino.** Choisis un montage, change de scène lumineuse et retrouve les réglages sauvegardés sur ton véhicule.

[Installer CELK](versions/0.2.0-rc.1/INSTALLATION.md) · [Dépendances et intégrations](COMPATIBILITE.md) · [Fonctionnalités et suivi](FEATURES.md) · [Préversion GitHub](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.2.0-rc.1)

## Téléchargements

**Version d’essai actuelle · CELK 0.2.0-rc.1.** Pour essayer le montage Phantom Police, télécharge les deux ZIP.

| Fichier | Version | Lien direct |
| --- | --- | --- |
| Script CELK | **0.2.0-rc.1** | [Télécharger le script](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/3f5ba2aba6c66d9fecd1b63792cd6931f8e14f1c/telechargements/CELK-script-0.2.0-rc.1.zip) |
| Pack Phantom Grand Format | **0.1.0**, notice 2.2 | [Télécharger le pack Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/3f5ba2aba6c66d9fecd1b63792cd6931f8e14f1c/telechargements/CELK-phantom-grand-format-0.1.0-revue-2.2.zip) |

[SHA-256 des deux ZIP](versions/0.2.0-rc.1/SHA256SUMS.txt) · [Notes de la version d’essai](versions/0.2.0-rc.1/README.md)

> [!IMPORTANT]
> **Essentiel pour l’installation** · un serveur FiveM opérationnel, FXServer **38435 ou plus récent**, GTA build serveur **3889 ou plus récente**, **OneSync** et les deux ZIP. FXServer fournit le moteur Node.js 22. L’installation de base se fait en mode autonome avec le pack Phantom.

> [!WARNING]
> ⚠️ ATTENTION — TRÈS IMPORTANT : démarrer les packs avant CELK
>
> Dans le CFG actif, démarre chaque ressource de pack requise avant `celk_runtime`. Pour Phantom, l’ordre est `ensure celk_pack_phantom`, puis `ensure celk_runtime`.

## Premier démarrage

1. Copie les dossiers `celk_pack_phantom` et `celk_runtime` dans les ressources de la bonne instance FiveM.
2. Place la configuration d’exemple et la livraison Phantom dans `celk_runtime/local`, puis règle les droits ACE et le démarrage dans le CFG.
3. Précontrôle et active le montage depuis la console serveur. Au volant du Phantom, lie le véhicule et essaie **F6** pour le montage, **J** pour la scène et **Q** pour les éclats.

[Étapes complètes avec txAdmin](versions/0.2.0-rc.1/INSTALLATION.md) · [Dépannage](versions/0.2.0-rc.1/INSTALLATION.md#dépannage)

<details>
<summary><strong>Qbox, Luxart et autres scripts</strong></summary>

CELK démarre en mode autonome. **Qbox, Luxart Vehicle Control, Ox et les scripts de garage ou de mécanique** ont leur propre installation. Le tableau de compatibilité indique les essais de développement, les raccords à qualifier et les dépendances réellement nécessaires. [État des intégrations](COMPATIBILITE.md#intégrations-optionnelles)

</details>

## Phantom Grand Format

Le pack Phantom Police réunit quatre types d’optiques, un montage de 14 pièces et cinq scènes pour le Phantom GTA. [Fiche du pack](PACKS.md)

![Les quatre optiques Phantom allumées sur un établi dans un garage mécanique](download.png)

*Visuel de présentation des optiques conçues par Spino. La texture et la teinte du métal illustrent la scène.*

<details>
<summary><strong>Photos à préparer</strong></summary>

| Emplacement | Photo à prendre |
| --- | --- |
| 📷 **PHOTO À AJOUTER · Placement avant** | Phantom Police en trois-quarts avant, véhicule entier, feux éteints. Prendre la calandre, le pare-chocs et le pare-brise dans le même cadre. |
| 📷 **PHOTO À AJOUTER · Scène en jeu** | Phantom en trois-quarts arrière avec une scène allumée, pour voir les optiques arrière et le côté du véhicule. Garder le nom de la scène pour la légende. |
| 📷 **PHOTO À AJOUTER · Choix du montage** | Capture de **F6** sur le Phantom à l’arrêt. Montrer le nom du montage sélectionné et laisser assez de place pour voir les pièces posées. |

</details>

## Fonctionnalités et suivi

La version d’essai permet de configurer plusieurs modèles, de garder leurs variantes et de restaurer des montages. Elle accepte **128 modèles et 32 packs** au maximum par configuration. **Multijoueur non testé.** [Fonctionnalités disponibles et à venir](FEATURES.md) · [Notes de version](CHANGELOG.md) · [Retours multijoueurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)

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
