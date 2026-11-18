# CELK 0.3.1 · Préversion FiveM

**18 novembre 2026 · par Spino**

[Script CELK 0.3.1](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/CELK-script-0.3.1.zip) · [Installation](INSTALLATION.md) · [Empreintes SHA-256](SHA256SUMS.txt) · [Préversion GitHub](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.1)

| Véhicule GTA | Ensemble FiveM | Configuration |
| --- | --- | --- |
| **Phantom Grand Format Police** · `phantom` | [ZIP Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-phantom-060a37bf.zip) | [phantom.json](configurations/phantom.json) |
| **Airport Bus Police V05** · `airbus` | [ZIP Airport Bus](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-airbus-78be8891.zip) | [airbus.json](configurations/airbus.json) |
| **Kuruma V05** · `kuruma` | [ZIP Kuruma](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-kuruma-41340f59.zip) | [kuruma.json](configurations/kuruma.json) |

La numérotation **0.3.1** identifie la publication. Le ZIP contient à l’octet le lecteur FiveM éprouvé dont le manifeste indique **`0.3.0-refonte.3`**. Les ensembles Phantom et Airport Bus indiquent **`0.3.0-refonte.1`** dans leur enveloppe, une révision que le lecteur livré accepte. L’enveloppe Kuruma indique **`0.3.0-refonte.3`**.

## Essais et limites

| Ensemble | Contrôles GTA solo |
| --- | --- |
| **Phantom `060a37bf`** | Sélection du montage, passage entre les scènes Spino et Rafale en contretemps, extinction et reprise du montage à la recréation du véhicule avec feux éteints. |
| **Airport Bus `78be8891`** | Trois scènes, dont Tour du périmètre, quatre modules blancs PR06 commandés via J et retour de la souris. |
| **Kuruma `41340f59`** | **4/4 par Julien**. Passage Police v2 → Ambulance blanche → Mécano jaune, effets du montage précédent retirés, reprise du Mécano avec feux éteints, retour de la rampe en Police. |

Au banc, **76 vérifications** depuis les ZIP exacts ont couvert chaque ensemble et le trio (**3 modèles, 5 variantes**), dont le précontrôle, l’installation, la réinstallation sans doublon et la relecture après redémarrage simulé.

Le Fantôme et l’Airport Bus ont été contrôlés pendant la séance à trois véhicules. La révision Kuruma distribuée a été validée ensuite dans un essai solo dédié. Le trio exact de cette préversion reste à vérifier ensemble en GTA. **Performance en charge, multijoueur et intégration Qbox** sont reportés à la qualification **0.3.2**.

[Suivi des fonctionnalités](../../FEATURES.md) · [Dépendances](../../COMPATIBILITE.md) · [Retours multijoueurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)
