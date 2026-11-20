# Installer CELK 0.3.3.2

Vérifier les [empreintes SHA-256](SHA256SUMS.txt). Le cœur demande FXServer 38435 ou supérieur, GTA build 3889, OneSync et Node 22 dans FXServer. La préparation externe a été vérifiée avec Node 24.22.3 sous Windows.

1. Pour une mise à jour, conserver l’instance et ses montages. Préparer une copie de travail et remplacer le cœur et le préparateur ensemble. Extraire le cœur dans `runtime` pour obtenir `runtime/celk_runtime/fxmanifest.lua`. Extraire le préparateur à la racine de cette copie.
2. Vérifier que la politique `instance/policy.json` désigne les éditeurs approuvés et que `instance/packs` contient les ensembles complets avec leurs manifestes. Les montages continuent d’utiliser le lecteur `0.3.3-sadler.1`.
3. Valider l’installation avec `node launcher.cjs --home instance`. Pour inclure la gestion des packs par F10, utiliser `node launcher-admin.cjs --home instance` et vérifier la sélection dans `instance/selection-admin.json`.
4. Préparer la configuration locale selon le [guide du lanceur CELK](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/428ea7a7bb56ebf9dca75775d144db9e336fa3c0/versions/0.3.2/INSTALLATION.md). Le lanceur génère l’ordre de démarrage. Avec le gestionnaire de dépôt, lancer `node launcher-admin.cjs --home instance --start`.

**Démarrer les ressources des packs avant `celk_runtime`.** Le premier contrôle en jeu consiste à faire `F6` puis `Échap` sur un véhicule admissible. La scène doit rester visible pendant tout le cycle et le jeu doit reprendre le contrôle de la souris à la fermeture.

| Adaptateur | Ressources et dépendances |
| --- | --- |
| Qbox | `celk_qbox_adapter` 0.3.3. Tester avec Qbox Core 1.24.1, Vehicles 1.4.2 et Garages 1.1.4. |
| LVC | Plugin CELK pour LVC 3.2.9 Rev2. Installer LVC et RageUI auprès de leurs éditeurs. Extraire le dossier `PLUGINS/CELK` dans la ressource LVC. |
| ox_lib | `celk_menu_ox` 0.3.3.2, raccord J/F6 API 1, pour ox_lib 3.42.2. Démarrer après ox_lib et le cœur CELK. Régler `setr celk_interface_provider celk_menu_ox` pour lui donner les panneaux J/F6. |

L’administration autonome utilise F10. Pour intégrer un menu administrateur existant, régler `setr celk_admin_owns_f10 0` et appeler `celk_admin` depuis ce menu. Accorder le droit serveur `celk.admin.packs` aux administrateurs concernés.
