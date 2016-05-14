const dialog = require('electron').remote.dialog;
var converter = require('image-to-icon-converter');

var platforms;

require('shelljs/global');

var setLoader = function(bool, ended) {

  if (bool == true) {
    $('#loader').addClass('active');
  } else if (bool == false) {
    $('#loader').removeClass('active');
  } else {
    $('#loader div').text(bool);
  }

};

var done = function(err) {

  if (!err) {

    platforms -= 1;

    if (platforms == 0) {

      $('#loader div').transition('hide');
      $('#success').transition('horizontal flip in');
      setTimeout(function () {
        $('#loader div').transition('show');
        $('#success').transition('horizontal flip out');
        setLoader(false);
      }, 1250);

    }

  } else {

    alert("An error occurred. Please try again.");

    //$('#loader div').transition('hide');

  }

};

var generators = {};

generators['osx'] = function (args) {
  platforms += 1;

  setLoader('Downloading OSX binaries');

  var loveZipBinary = args.cacheDirectory + '/love-' + args.loveVersion + '-macosx-x64.zip';
  var infoFile = args.gameName + '.app/Contents/Info.plist';
  var bundleName = 'org.' + args.gameAuthor.toLowerCase().replace(/[^\w]/gi, '') +
    '.' + args.gameName.toLowerCase().replace(/[^\w]/gi, '');

  var steps = {};
  steps[0] = function () { //download love zip

    if (!test('-f', loveZipBinary)) { //file doesn't exist
      exec('curl -L -C - -o ' +
      loveZipBinary + ' https://bitbucket.org/rude/love/downloads/love-' + args.loveVersion + '-macosx-x64.zip',
      { async: true }, steps[1]);
    } else {
      steps[1]();
    }

  };
  steps[1] = function () { //unzip love binary

    setLoader('Unzipping LÖVE');

    cd(args.cacheDirectory);
    exec('unzip -o ' + loveZipBinary, { async: true }, steps[2]);

  };
  steps[2] = function () { //generate .app

    setLoader('Generating OSX app');

    rm('-rf', args.gameName + '-macosx-x64.zip'); //remove zip
    rm('-rf', args.gameName + '.app'); //remove app

    mv('love.app', args.gameName + '.app');
    cp(args.gameFile.path, args.gameName + '.app/Contents/Resources');
    mv(args.gameName + '.app/Contents/Resources/' + args.gameFile.name, args.gameName + '.app/Contents/Resources/' + args.gameName + '.love');

    exec("sed -i.bak -e '92,119d' " + infoFile, { async: true }, function() {
      if (args.gameIcon) {
        steps[3](); // add icon
      } else {
        steps[4](); // skip
      }
    });

  };
  steps[3] = function () { //generate icon

    setLoader('Generating OSX icon');

    var iconName = (args.loveVersion == '0.9.2') ? 'Icon.icns' : 'OS X AppIcon.icns';

    converter.uploadConvertDownload(args.gameIcon.path, 'icns').then(function(iconUrl) {

      rm('-rf', args.gameName + '.app/Contents/Resources/' + iconName);

      exec('curl -L -C - -o ' +
      args.cacheDirectory + '/Icon.icns ' + iconUrl,
      { async: true }, function() {

        mv('Icon.icns', args.gameName + '.app/Contents/Resources/' + iconName);
        steps[4]();

      });

    });

  };
  steps[4] = function (code) { //remove stuff from Info.plist

    setLoader('Configuring OSX app');

    sed('-i', '>org.love2d.love<', '>' + bundleName + '<', infoFile);
    sed('-i', args.loveVersion, args.gameVersion, infoFile);
    sed('-i', '>LÖVE<', '>' + args.gameName + '<', infoFile);

    rm('-rf', infoFile + '.bak'); //TODO useless

    cd(args.cacheDirectory);

    exec('zip -r -m -y "' + args.gameName + '-macosx-x64.zip" "' + args.gameName + '.app"',
    { async: true }, steps[5]); // TODO doesn't work well

  };
  steps[5] = function (code) { //move to release directory
    if (code !== 0)
      return done('error'); //TODO zipping might have failed - temporary fix

    mv(args.gameName + '-macosx-x64.zip', args.releaseDirectory + '/' + args.gameName + '-macosx-x64.zip');

    setTimeout(function() { done() }, 1000);

  };

  steps[0]();

};

generators['windows'] = function (args) {
  platforms += 1;

  setLoader('Downloading Windows binaries');

  var loveZipBinary = args.cacheDirectory + '/love-' + args.loveVersion + '-win32.zip';

  var steps = {};
  steps[0] = function () { //download love zip

    if (!test('-f', loveZipBinary)) { //file doesn't exist
      exec('curl -L -C - -o ' +
      loveZipBinary + ' https://bitbucket.org/rude/love/downloads/love-' + args.loveVersion + '-win32.zip',
      { async: true }, steps[1]);
    } else {
      steps[1]();
    }

  };
  steps[1] = function () { //unzip love binary

    setLoader('Unzipping LÖVE');

    cd(args.cacheDirectory);
    exec('unzip -o ' + loveZipBinary, { async: true }, steps[2]);

  };
  steps[2] = function () { //generate .exe

    setLoader('Generating Windows executable');

    rm('-rf', args.gameName + '-win32.zip'); //remove zip
    rm('-rf', args.gameName + '.exe'); //remove exe

    mv('love-' + args.loveVersion + '-win32', args.gameName + '-win32');

    cd(args.cacheDirectory + '/' + args.gameName + '-win32');

    exec('cat love.exe "' + args.gameFile.path + '" > "' + args.gameName + '.exe"',
    { async: true }, steps[3]); //create combined executable

  };
  steps[3] = function (code) { //zip folder

    if (code !== 0)
      return done('error');

    rm('-rf', 'love.exe');

    cd(args.cacheDirectory);
    
    exec('zip -r -m -y "' + args.gameName + '-win32.zip" "' + args.gameName + '-win32"',
    { async: true }, steps[4]); // TODO doesn't work well

  }
  steps[4] = function (code) { //move to release directory

    if (code !== 0)
      return done('error'); //TODO zipping might have failed - temporary fix

    mv(args.gameName + '-win32.zip', args.releaseDirectory + '/' + args.gameName + '-win32.zip');

    setTimeout(function() { done() }, 1000);

  }

  steps[0]();

};

var generateGame = function() {
  var args = {
    gameName: $('#game-name').val(),
    gameAuthor: $('#game-author').val() || 'Love2D',
    loveVersion: $('#love-version').val(),
    gameVersion: $('#game-version').val() || '1.0',
    gameFile: $('#game-file')[0].files[0],
    gameIcon: $('#game-icon')[0].files[0],
    releaseDirectory: $('#release-directory').val(),
    cacheDirectory: '~/.cache/love-packer'
  }
  console.log(args);

  setLoader(true);
  platforms = 0;

  /* start doing the magic */
  mkdir('-p', args.cacheDirectory, args.releaseDirectory); //make sure directories are there
  /* execute generators */
  if ($('#os-windows').hasClass('active')) { generators['windows'](args); };
  if ($('#os-osx').hasClass('active')) { generators['osx'](args); };
  /* magic has ended */

  //

  return false; //prevent form from being submitted
};

$(document)
  .ready(function() {

    $('select.dropdown').dropdown();

    $('.ui.button.toggle').state();

    $('.ui.modal').modal();
    $('.ui.modal').modal('hide dimmer');

    // $('#love-logo').transition('set looping').transition('bounce', '2000ms');

    $('#success').transition('hide', 0); // TODO

    //$('#loader').transition('fade');

    $('.fake-file-input')
    	.on('click', function(e) {
        	$(e.target).next().click();
    	})
    ;

    $('.fake-directory-input')
    	.on('click', function(e) {
          var file = dialog.showOpenDialog({
            properties: [ 'openDirectory' ]
          })[0];
          if (!file)
            return false;
          $('input:text', $(e.target).parent()).val(file);
    	})
    ;

    $('input:file')
    	.on('change', function(e) {
          var file = e.target.files[0];
          if (!file)
            return false;
        	var name = file.name;
        	$('input:text', $(e.target).parent()).val(name);
    	})
    ;

    $('.ui.form')
      .form({
        onSuccess: generateGame,
        on: 'blur',
        inline: true,
        fields: {
          gameName: {
            identifier: 'game-name',
            rules: [
              {
                type: 'empty',
                prompt: 'Please enter a game name'
              }
            ]
          },
          gameAuthor: {
            optional: true,
            identifier: 'game-author',
            rules: []
          },
          gameVersion: {
            optional: true,
            identifier: 'game-version',
            rules: [
              {
                type: 'decimal',
                prompt: 'Version should be semantic (x.x.x)'
              }
            ]
          },
          loveVersion: {
            identifier: 'love-version',
            rules: []
          },
          gameFile: {
            identifier: 'game-file',
            rules: [
              {
                type: 'empty',
                prompt: 'Please select a LÖVE file'
              }
            ]
          },
          releaseDirectory: {
            identifier: 'release-directory',
            rules: [
              {
                type: 'empty',
                prompt: 'Please select a release directory'
              }
            ]
          }
        }
      })
    ;



  })
;
