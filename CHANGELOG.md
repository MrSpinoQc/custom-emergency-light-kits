# Notes de version

[État des fonctionnalités et travaux prévus](FEATURES.md)

## 0.3.2 · Préversion · 18 novembre 2026

- Dépôt des trois ensembles FiveM compatibles avec génération de la configuration, préservation des sélections inchangées et ordre de démarrage calculé.
- Cœur à la version publique 0.3.2 et au manifeste interne `0.3.2-prototype.1`.
- Adaptateurs CELK **0.3.3** facultatifs distribués séparément pour Qbox et LVC, avec versions éditeur et procédures dédiées.
- Quatre profils FXServer contrôlés avec et sans Qbox et LVC. En GTA solo sur la paire distribuée, Julien a validé la Kuruma Police v2 avec le garage Qbox officiel et LVC 3.2.9 Rev2. Q allume sans roue radio, Alt commande la sirène et Q coupe les deux effets. Au retour du garage, les sept pièces sont déjà posées et les feux restent éteints.
- Multijoueur et performance sous charge à qualifier.

[Préversion](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.2) · [Installation](versions/0.3.2/INSTALLATION.md) · [Adaptateurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/adaptateurs-v0.3.3) · [Empreintes](versions/0.3.2/SHA256SUMS.txt)

## 0.3.1 · Préversion · 18 novembre 2026

- Script public et trois ensembles distincts. Phantom Grand Format Police `060a37bf`, Airport Bus Police V05 `78be8891` et Kuruma V05 à trois variantes `41340f59`.
- Lecteur FiveM livré à l’octet avec son identifiant interne `0.3.0-refonte.3`.
- Contrôles GTA solo du Fantôme et de l’Airport Bus, puis validation solo 4/4 de l’ensemble Kuruma exact par Julien.
- Banc d’installation depuis les ZIP exacts. 76 contrôles sur les ensembles séparés et le trio.
- Performance sous charge, multijoueur et raccord Qbox reportés à la 0.3.2.

[Préversion](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.1) · [Essais détaillés](versions/0.3.1/README.md#essais-et-limites) · [Installation](versions/0.3.1/INSTALLATION.md) · [Empreintes](versions/0.3.1/SHA256SUMS.txt)

## 0.2.0-rc.2-hellfire.5 · Hellfire Police V08 · 17 novembre 2026

- Publication du script qualifié avec l’export Hellfire Police V08 à 15 pièces et la scène Double alternance de 50 pistes.
- Lecture Centre R02 corrigée pour les clips `projection:true`, y compris sans diffusion personnalisée enregistrée pour l’optique.
- Trois ressources Hellfire distribuées ensemble dans le ZIP du pack, configuration et guide dédiés.
- **5/5 GTA solo**, **56/56 Node**, banc Lua simulé et **3/3 sondes Atelier**. Les empreintes des 145 actifs stream concordent avec le Studio.
- Multijoueur en phase 3, différé et non validé.

[Notes détaillées](versions/0.2.0-rc.2-hellfire.5/README.md) · [Installation](versions/0.2.0-rc.2-hellfire.5/INSTALLATION.md) · [Empreintes](versions/0.2.0-rc.2-hellfire.5/SHA256SUMS.txt)

## Documentation · 16 novembre 2026

Guide d’installation détaillé, tableau des intégrations FiveM et emplacement des futures photos du Phantom. [Installation](versions/0.2.0-rc.1/INSTALLATION.md) · [Dépendances et intégrations](COMPATIBILITE.md)

## Script 0.2.0-rc.1 · parcours Phantom historique

[Changements, téléchargements et limites de 0.2.0-rc.1](versions/0.2.0-rc.1/README.md).

## Script candidat 0.1.2 · revue technique publique

- À l’arrêt de la ressource, le client détache et supprime les boîtiers et leurs lentilles. Le menu rend le contrôle au joueur.
- Le pack Phantom 0.1.0, les montages et les sauvegardes gardent le même format. La [mise à jour](MISES-A-JOUR.md) se fait manuellement.
- En GTA solo, les montages d’essai à 14 et 20 accessoires sont restés attachés pendant les deux passages en mouvement. L’arrêt de CELK a supprimé les pièces et sa relance a restauré le montage à 14 pièces avec les feux éteints. La synchronisation à deux clients reste non validée. L’essai est différé sans échéance.

## Pack Phantom Grand Format 0.1.0 · notice 2.2

- Montage Police pour le modèle `phantom` de GTA V. La livraison fournie propose une variante à 14 accessoires et cinq scènes.
- Démarrage de l’ensemble vérifié sur FXServer Windows 38435, GTA build serveur 3889 et OneSync. Les essais incluent l’activation, une migration témoin et le retour arrière.
- Les archives du pack et du script ont chacune leur version et leur empreinte. [Téléchargements actuels](README.md#téléchargements) · [Archives 0.1.2](README.md#archives).
