import app from 'flarum/admin/app';

app.initializers.add('ernestdefoe-parley', () => {
  app.registry
    .for('ernestdefoe-parley')
    .registerPermission(
      {
        icon: 'fas fa-comments',
        label: app.translator.trans('ernestdefoe-parley.admin.permissions.use'),
        permission: 'ernestdefoe-parley.use',
      },
      'start'
    )
    .registerPermission(
      {
        icon: 'fas fa-user-secret',
        label: app.translator.trans('ernestdefoe-parley.admin.permissions.hide_from_list'),
        permission: 'ernestdefoe-parley.hideFromList',
      },
      'moderate'
    )
    .registerPermission(
      {
        icon: 'fas fa-flag',
        label: app.translator.trans('ernestdefoe-parley.admin.permissions.moderate'),
        permission: 'ernestdefoe-parley.moderate',
      },
      'moderate'
    )
    .registerSetting({
      setting: 'ernestdefoe-parley.away_minutes',
      type: 'number',
      min: 1,
      max: 120,
      label: app.translator.trans('ernestdefoe-parley.admin.settings.away_minutes'),
      help: app.translator.trans('ernestdefoe-parley.admin.settings.away_minutes_help'),
    })
    .registerSetting({
      setting: 'ernestdefoe-parley.max_image_mb',
      type: 'number',
      min: 1,
      max: 50,
      label: app.translator.trans('ernestdefoe-parley.admin.settings.max_image_mb'),
      help: app.translator.trans('ernestdefoe-parley.admin.settings.max_image_mb_help'),
    });
});
