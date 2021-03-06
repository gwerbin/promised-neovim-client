var cp = require('child_process');

var attach = require('./index').attach;


var proc = cp.spawn('nvim', ['-u', 'NONE', '-N', '--embed'], {
  cwd: __dirname
});

var typeMap = {
  'String': 'string',
  'Integer': 'number',
  'Boolean': 'boolean',
  'Array': 'Array<RPCValue>',
  'Dictionary': 'Object',
};

function convertType(type) {
  if (typeMap[type]) return typeMap[type];
  var genericMatch = /Of\((\w+)[^)]*\)/.exec(type);
  if (genericMatch) {
    var t = convertType(genericMatch[1]);
    if (/^Array/.test(type))
      return 'Array<' + t + '>';
    else
      return '{ [key: string]: ' + t + '; }';
  }
  return type;
}

function metadataToSignature(method) {
  var params = [];
  for (var i = 0; i < method.parameters.length; i++) {
    params.push(method.parameters[i] + ': ' + convertType(method.parameterTypes[i]));
  }
  return '  ' + method.name + '(' + params.join(', ') + '): Promise<' + convertType(method.returnType) + '>;\n';
}

attach(proc.stdin, proc.stdout).then(function(nvim) {
  var interfaces = {
    Nvim: nvim.constructor,
    Buffer: nvim.Buffer,
    Window: nvim.Window,
    Tabpage: nvim.Tabpage,
  };

  // use a similar reference path to other definitely typed declarations
  Object.keys(interfaces).forEach(function(key) {
    if (key === 'Nvim') {
        process.stdout.write('export interface ' + key + ' extends NodeJS.EventEmitter {\n');
        process.stdout.write('  uiAttach(width: number, height: number, rgb: boolean, cb?: Function): void;\n');
        process.stdout.write('  uiDetach(cb?: Function): void;\n');
        process.stdout.write('  uiTryResize(width: number, height: number, cb?: Function): void;\n');
        process.stdout.write('  quit(): void;\n');
    } else {
        process.stdout.write('export interface ' + key + ' {\n');
    }
    Object.keys(interfaces[key].prototype).forEach(function(method) {
      method = interfaces[key].prototype[method];
      if (method.metadata) {
        process.stdout.write(metadataToSignature(method.metadata));
      }
    })
    process.stdout.write('  equals(lhs: ' + key + '): boolean;\n')
    process.stdout.write('}\n');
  });

  process.stdout.write('export function attach(writer: NodeJS.WritableStream, reader: NodeJS.ReadableStream): Promise<Nvim>;\n\n');


  process.stdout.write('export type RPCValue = Buffer | Window | Tabpage | number | boolean | string | any[] | {[key:string]: any};\n')

  proc.stdin.end();
}).catch(function(err){ console.error(err); });
