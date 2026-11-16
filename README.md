# Custom Emergency Light Kits

**Un projet de Spino pour FiveM.** CELK ajoute des optiques d’urgence, des montages et des séquences lumineuses aux véhicules compatibles.

## Téléchargements

**Version d’essai actuelle du script · 0.2.0-rc.1.** Pour essayer le montage Phantom Police, télécharge le script et le pack ci-dessous. Le script et le pack ont chacun leur numéro de version.

| Fichier | Version | Lien direct |
| --- | --- | --- |
| Script CELK | **0.2.0-rc.1** | [Télécharger le script](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/main/telechargements/CELK-script-0.2.0-rc.1.zip) |
| Pack Phantom Grand Format | **0.1.0**, notice 2.2 | [Télécharger le pack Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/main/telechargements/CELK-phantom-grand-format-0.1.0-revue-2.2.zip) |

[Guide d’installation txAdmin](versions/0.2.0-rc.1/INSTALLATION.md) · [Nouveautés de 0.2.0-rc.1](versions/0.2.0-rc.1/README.md) · [SHA-256 du script](versions/0.2.0-rc.1/SHA256SUMS.txt) · [SHA-256 du pack](telechargements/SHA256SUMS.txt)

> [!WARNING]
> ⚠️ ATTENTION — TRÈS IMPORTANT : démarrer les packs avant CELK
>
> Dans le CFG actif, démarre chaque ressource de pack requise avant `celk_runtime`. Voici l’ordre pour le pack Phantom.

```cfg
ensure celk_pack_phantom
ensure celk_runtime
```

## Version d’essai 0.2.0-rc.1

Cette version ajoute la gestion de plusieurs modèles et la restauration d’un montage retiré en conservant les choix sauvegardés. **Multijoueur non testé.** Les retours sont bienvenus. [Annonce et retours](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)

**Limites actuelles** · jusqu’à **128 modèles GTA distincts** et **32 packs distincts** par configuration CELK. [Détail des limites](versions/0.2.0-rc.1/README.md#limites-du-multi-packs) · [Code de 0.2.0-rc.1](versions/0.2.0-rc.1/celk_runtime)

Les conditions de partage et la licence restent à définir.

## Fonctionnalités et suivi

Consulte les fonctionnalités disponibles, les chantiers en cours, les ajouts confirmés pour plus tard et les essais reportés. [Voir les fonctionnalités](FEATURES.md) · [Suivre les mises à jour](CHANGELOG.md)

## Phantom Grand Format

Phantom Grand Format est le premier kit présenté. Il comprend quatre types d’optiques, conçues pour la calandre, le pare-chocs, le pare-brise et les marchepieds.

![Les quatre optiques Phantom allumées sur un établi dans un garage mécanique](download.png)

*Visuel de présentation des optiques conçues par Spino. La texture et la teinte du métal illustrent la scène.*

[Détails du pack Phantom](PACKS.md)

## Archives

La première revue publique, **CELK 0.1.2**, couvrait le montage Phantom Police. [Télécharger le script 0.1.2 archivé](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/main/telechargements/CELK-script-0.1.2-candidat.zip) · [Guide 0.1.2](INSTALLATION.md) · [Code 0.1.2](celk_runtime) · [Empreintes d’origine](telechargements/SHA256SUMS.txt) · [Notes de version](CHANGELOG.md)
