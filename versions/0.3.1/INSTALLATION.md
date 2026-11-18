# Installer CELK 0.3.1 sur FiveM

**Prérequis** · FXServer **38435+**, GTA build serveur **3889+**, OneSync et **Node.js 22** fourni par FXServer, avec un client FiveM et GTA V. Le lecteur du ZIP conserve sa version interne **`0.3.0-refonte.3`**. [Compatibilité et droits](../../COMPATIBILITE.md)

## 1. Télécharger et vérifier

[Script CELK 0.3.1](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/CELK-script-0.3.1.zip) · [Empreintes SHA-256](SHA256SUMS.txt)

| Véhicule GTA | Ensemble FiveM | Configuration |
| --- | --- | --- |
| **Phantom Grand Format Police** · `phantom` | [ZIP Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-phantom-060a37bf.zip) | [phantom.json](configurations/phantom.json) |
| **Airport Bus Police V05** · `airbus` | [ZIP Airport Bus](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-airbus-78be8891.zip) | [airbus.json](configurations/airbus.json) |
| **Kuruma V05** · `kuruma` | [ZIP Kuruma](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-kuruma-41340f59.zip) | [kuruma.json](configurations/kuruma.json) |

L’exemple [trois-packs.json](configurations/trois-packs.json) configure les trois ensembles ensemble. Pour une autre combinaison, réunis uniquement les entrées `scopes` et `packs` des véhicules que tu installes dans un seul JSON de version 1.

Pour contrôler un ZIP sous Windows, lance `Get-FileHash <fichier.zip> -Algorithm SHA256` dans PowerShell et compare le résultat au [relevé SHA-256](SHA256SUMS.txt).

## 2. Placer les ressources et les ensembles

1. Décompresse le ZIP du script et place le dossier `celk_runtime` sous `resources/` sur ton serveur. Pour une mise à jour, lis d’abord [la procédure de sauvegarde](#mise-à-jour-et-retour-arrière).
2. Décompresse chaque ensemble choisi dans `celk_runtime/local/install-sets/`. Garde le dossier qui contient `installation.json`, `selection/` et `resources/`. Par exemple, `celk_runtime/local/install-sets/ensemble-phantom-060a37bf/installation.json` doit exister.
3. **Copie** le dossier `celk_pack_…` depuis le sous-dossier `resources/` de l’ensemble vers le dossier `resources/` du serveur. Garde aussi sa copie dans l’ensemble, car le lecteur vérifie son contenu.
4. Place l’exemple JSON choisi à `celk_runtime/local/celk.config.json`. Pour une installation existante, adapte une copie de ta configuration.

## 3. Démarrer les ressources

Dans `server.cfg`, conserve les ressources des ensembles installés et démarre-les avant le lecteur. Exemple avec les trois ensembles.

```cfg
ensure celk_pack_phantom
ensure celk_pack_airport_bus_v05
ensure celk_pack_kuruma_r03
ensure celk_runtime

add_ace group.admin celk.bind allow
add_ace group.admin celk.fit allow
add_ace group.admin celk.drive allow
```

Adapte les droits ACE aux personnes qui font les essais. Sur un serveur déjà allumé, exécute aussi `refresh` avant de démarrer les nouvelles ressources.

## 4. Installer le montage de chaque modèle

Dans la console **serveur** FiveM ou txAdmin, exécute le précontrôle de chaque ensemble choisi. Exemple pour le Phantom.

```text
celk_preflight_set ensemble-phantom-060a37bf
celk_install_set ensemble-phantom-060a37bf <empreinte-du-plan>
```

Remplace `<empreinte-du-plan>` par les 64 caractères affichés par la commande de précontrôle. Fais un nouveau précontrôle si le plan a changé ou si l’installation est refusée. Utilise le nom du dossier décompressé pour l’Airport Bus et la Kuruma.

Quand les installations sont terminées, redémarre **uniquement** CELK et lis le statut en console.

```text
restart celk_runtime
celk_status
```

Vérifie que le statut montre **une variante** pour le Phantom, **une** pour l’Airport Bus et **trois** pour la Kuruma, selon les ensembles installés.

## 5. Essayer en jeu

À l’arrêt au volant du modèle choisi, lie le véhicule en tapant `/celk_bind <id-durable>` dans le chat FiveM ou `celk_bind <id-durable>` dans F8. Utilise un identifiant distinct par véhicule. **F6** choisit le montage, **J** ouvre les scènes et commandes disponibles, et **Q** allume ou éteint les éclats.

## Dépannage

- **Ressource arrêtée ou absente** · vérifie les noms des dossiers et l’ordre des `ensure`.
- **Plan refusé** · vérifie la config, la structure du dossier de l’ensemble et les SHA-256, puis relance le précontrôle.
- **Modèle absent ou suspendu** · ouvre `celk_status` après avoir redémarré CELK. Vérifie la variante disponible, la version du pack et le diagnostic de la console.
- **Menu inaccessible** · vérifie la liaison du véhicule et les droits ACE. Les commandes peuvent être réaffectées dans FiveM.

## Mise à jour et retour arrière

Conserve ensemble les archives du script, des packs, le CFG et une sauvegarde de tout `celk_runtime/local/`. Installe la 0.3.1 sur une copie et vérifie tes montages et sauvegardes avant un remplacement. En cas de retour arrière, rétablis la combinaison précédente et ses données locales à partir de la même sauvegarde. [Versions archivées](../../README.md#archives)
