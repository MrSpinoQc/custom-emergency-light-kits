# CELK 0.2.0-rc.1 · Version d’essai

> [!NOTE]
> **Archive.** Ce guide accompagne la version indiquée ci-dessous. [Installer la préversion actuelle](../0.3.1/INSTALLATION.md)

**Spino · Custom Emergency Light Kits**

- [Télécharger le script 0.2.0-rc.1](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/3f5ba2aba6c66d9fecd1b63792cd6931f8e14f1c/telechargements/CELK-script-0.2.0-rc.1.zip)
- [Télécharger le pack Phantom Grand Format 0.1.0](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/3f5ba2aba6c66d9fecd1b63792cd6931f8e14f1c/telechargements/CELK-phantom-grand-format-0.1.0-revue-2.2.zip)
- [Installer le Phantom avec 0.2.0-rc.1](INSTALLATION.md) · [Retour à 0.1.2](INSTALLATION.md#mise-à-jour-et-retour-arrière) · [Vérifier le SHA-256](SHA256SUMS.txt)

[Code du script](celk_runtime) · [Dépendances et intégrations](../../COMPATIBILITE.md)

## Limites du multi-packs

- **128 modèles GTA distincts** au maximum dans `scopes` et **32 packs distincts** dans `packs`. Un pack partagé par plusieurs modèles compte une seule fois.
- **32 Kio (32 768 octets)** au maximum pour le fichier `local/celk.config.json`.
- **Une livraison active par modèle**, de **1 à 64 variantes par livraison**, et **20 pièces actives au maximum par véhicule**.

Les entrées par modèle et par pack sont dans `local/celk.config.json`. Dans le `server.cfg`, démarre les ressources des packs requis avant `celk_runtime`. [Contrôles de la configuration](celk_runtime/server/runtime-config.js#L20-L45) · [Contrôles des variantes](celk_runtime/server/model-exports.js)

## Changements

- Plusieurs modèles peuvent être configurés sur le même serveur. Chaque modèle a une livraison active et peut proposer plusieurs services et variantes. La limite reste **20 accessoires actifs par véhicule**.
- La mise à jour d’un modèle peut être appliquée séparément. Les choix sauvegardés sont conservés lors du retrait d’une variante ou d’un modèle. L’administrateur peut restaurer une révision précise.
- Le raccord Atelier a été vérifié avec une vraie livraison. Sur le Phantom, le retrait puis la restauration rendent les choix d’origine, avec les effets éteints. La livraison et le choix du Baller ont été conservés pendant l’opération.

## Périmètre vérifié

FiveM a relevé **37 tests Node réussis**, un contrôle Lua et **6 contrôles GTA solo réussis** sur FXServer 38435. Les essais solo couvrent le Phantom et un Baller de banc, F6/J/Q, la limite de 20 pièces et le retrait puis la restauration. Le téléchargement public est documenté avec le pack **Phantom**. Le pack Baller utilisé au banc appartient à la remise privée.

**Multijoueur non testé.** Les retours sont bienvenus. Indique les versions du script et des packs, le nombre de clients, le modèle et la variante, les étapes et ce que chaque joueur a vu. Retire les clés, adresses et données des joueurs des extraits joints. [Retours sur GitHub](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues)
