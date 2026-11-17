# CELK 0.2.0-rc.2-hellfire.5 · Hellfire Police V08

**Préversion publique · 17 novembre 2026 · Spino**

Un kit Police de **15 pièces** pour le Gauntlet Hellfire GTA, avec la rampe V08, les feux V07, deux projecteurs V06 et une scène Double alternance de **50 pistes**.

## Téléchargements

| Fichier | SHA-256 |
| --- | --- |
| [Script CELK](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/01a52dbff9574908095e3f96c431b27872746437/telechargements/CELK-script-0.2.0-rc.2-hellfire.5.zip) | `b6e9eec950c8b79717f4d1975dd0bfac995538f0828dbfc6cb11a2415e7f9be5` |
| [Pack Hellfire](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/01a52dbff9574908095e3f96c431b27872746437/telechargements/CELK-pack-Hellfire-personnel-fddf5f43.zip) | `998121228a566aecec2d7cf1c12ade5fd9b2651b180b1e830f87919a1392ab76` |

[Installer le kit](INSTALLATION.md) · [Configuration](celk.config.hellfire.example.json) · [Empreintes](SHA256SUMS.txt) · [Code du runtime](celk_runtime)

## Changements

- Montage Hellfire Police V08 complet avec les ressources V06 **0.6.0**, V07 **0.7.0** et V08 **0.8.0**.
- Lecture Centre R02 corrigée pour les clips `projection:true`, y compris lorsqu’aucune diffusion personnalisée n’est enregistrée pour l’optique.
- Précontrôle et installation d’un ensemble avec vérification des packs et empreinte du plan. Le rejeu d’une livraison identique conserve l’index.
- ZIP du runtime et ZIP du pack distribués séparément, avec une configuration Hellfire et un guide autonome.

## Essais et limites

| Niveau | Résultat |
| --- | --- |
| **GTA solo** | **5/5 contrôles validés** le 17 novembre 2026, un client Windows, FXServer **38435**, GTA **3889**, OneSync. |
| **Banc FiveM** | **56/56 tests Node**, Lua simulé et **3/3 sondes Atelier** concordants. |
| **Fichiers distribués** | Runtime de 32 fichiers et export de 155 fichiers conservés à l’identique. Les **145 actifs stream** concordent avec les empreintes Studio. |
| **Installation propre au banc** | Configuration Hellfire seule, précontrôle, installation, relecture et rejeu identique vérifiés avec les modules du runtime et des ressources FiveM simulées. |
| **Deux clients** | Phase 3, différé et non validé. |

Les contrôles GTA couvrent la pose F6, la diffusion et l’extinction Q, les deux têtes J aux limites avec leurs socles fixes, les portes, le mouvement et le retour du montage après recréation. Les commandes et la recréation utilisent le véhicule réseau. L’observation vers **30 m** a été faite sur une exposition locale à feux continus utilisant les mêmes fichiers client.

Les essais de performance et d’endurance à grande échelle restent à faire. La coexistence avec le Phantom historique et les intégrations tierces sous hellfire.5 demandent leur propre qualification. [Dépendances et intégrations](../../COMPATIBILITE.md)

## Versions et installation

Le manifeste demande FXServer **38435+**, GTA build **3889+**, OneSync et Node.js **22** dans FXServer. Démarre les trois ressources de pack avant CELK et utilise la [configuration Hellfire](celk.config.hellfire.example.json). L’enveloppe originale mentionne `hellfire.3`, reconnue explicitement par le lecteur hellfire.5.

L’installation et les mises à jour restent manuelles. Le guide détaille les sauvegardes, les étapes de contrôle et le retour arrière sur une copie cohérente. [Installation et restauration](INSTALLATION.md#mise-à-jour-et-retour-arrière)

## Crédit et historique

Création **Spino**. La licence générale et les conditions de partage restent à définir. Le pack Phantom Grand Format public et sa paire de versions documentée restent disponibles dans le [parcours historique](../0.2.0-rc.1/README.md).

[Catalogue](../../PACKS.md) · [Suivi du développement](../../FEATURES.md) · [Retours multijoueurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)
