# Installer CELK 0.3.3.5 · Sadler V05 R4

Cette préversion associe le lecteur **`0.3.3-socle.8`**, l’interface **`0.3.3.5-socle.1`** et le Sadler V05 R4. Utilise les ZIP distincts de la [préversion](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.3.5) et vérifie leurs [SHA-256](SHA256SUMS.txt) avant extraction.

## Préparer une instance distincte

1. Sauvegarde ta configuration, les montages, la base et la génération fonctionnelle. Pour tester R4, choisis une nouvelle instance et un dossier de travail court sous Windows. Les R3 et R4 partagent des noms de modèles GTA, donc charge une seule révision à la fois.
2. Extrais le préparateur à la racine du dossier de travail. Extrais le runtime dans `runtime` pour obtenir `runtime/celk_runtime/fxmanifest.lua`.
3. Extrais le ZIP Sadler dans `instance/packs/sadler-r4`. Ce dossier doit contenir directement `installation.json`, `selection/` et `resources/`. Laisse les trois ressources ensemble.
4. Dans `instance/policy.json`, autorise l’éditeur de ce pack. Exemple de politique pour une instance de test.

```json
{"schema":"tryagain.folder-admission","version":1,"trustedLocalPublishers":["spino"]}
```

5. Lance `node launcher.cjs --home instance`. Le préparateur indique la génération retenue. Démarre le serveur avec l’ordre qu’il produit. Les ressources de jeu démarrent avant `celk_runtime`. Reporte-toi au [guide de configuration du lanceur](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/428ea7a7bb56ebf9dca75775d144db9e336fa3c0/versions/0.3.2/INSTALLATION.md) pour les paramètres de démarrage.
6. En jeu, utilise un Sadler. Ouvre **F6**, équipe le montage à benne articulée, puis ouvre **J**. Déploie le panneau et choisis **Double flèche**. Vérifie ensuite la pause, la reprise et l’extinction au repli.

**Prérequis** · FXServer 38435 ou supérieur, build GTA 3889, OneSync et Node 22 fourni par FXServer. Pour préparer le dépôt hors de FXServer, les essais FiveM ont utilisé Node 24 sous Windows.

## Options

- **Administration F10** · Le préparateur inclut `celk_admin`. Sélectionne le dossier `sadler-r4` dans `instance/selection-admin.json` au format `celk.admin-selection` v1, puis utilise `node launcher-admin.cjs --home instance`. Le droit ACE `celk.admin.packs` contrôle l’accès.
- **Interface ox_lib** · Extrais `celk_menu_ox` séparément. Installe ox_lib auprès de son éditeur et démarre-le avant CELK. Démarre `celk_menu_ox` après `celk_runtime`. Pour l’activer, utilise `setr celk_interface_provider celk_menu_ox`. Le panneau CELK intégré est le mode autonome et assure le repli.
- **Qbox et LVC** · Les archives historiques restent associées à leurs releases. Leurs adaptateurs neutres n’ont pas été qualifiés sur cette préversion.

## Portée des essais et retour arrière

Le 25 novembre 2026, le runtime exact et le jeu R4 issu de l’export Atelier d’origine ont été essayés en GTA solo avec le panneau CELK intégré. Les 63 fichiers de jeu de ce téléchargement concordent octet pour octet avec l’arborescence de cet essai. La nouvelle archive a été rejouée hors jeu en mode autonome et avec la préparation de l’administration F10. L’adaptateur ox_lib a passé deux scénarios en simulation Lua. L’essai à deux clients est reporté et reste à faire.

Pour revenir en arrière, redémarre avec la configuration, la base, les ressources et la génération de la même version sauvegardée. La [préversion 0.3.3.2](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.3.2) reste disponible avec ses propres téléchargements.

Accessoires de signalisation par Try Again Studio 3D. Custom Emergency Light Kits par Spino.
