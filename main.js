var bert = require('./bert.js'),
    Duplex = require('stream').Duplex,
    util = require('util'),
    stdin = process.stdin, stdout = process.stdout,
    term_len = undefined;

util.inherits(Port, Duplex);

function Port() { Duplex.call(this,{objectMode: true}); }
var port = new Port();

Port.prototype._read = read_term
stdin.on('readable', read_term);
stdin.on('end', process.exit);

function read_term() {
  var term;
  if (term_len === undefined && null !== (term_bin = stdin.read(4))) {
    term_len = bert.bytes_to_int(term_bin,4,true);
  }
  if (term_len !== undefined && null !== (term = stdin.read(term_len))) {
    term_len = undefined;
    port.push(bert.decode(term));
  }
}

Port.prototype._write = function(obj, encoding, callback){
  var term = bert.encode(obj);
  var len = new Buffer(4); len.writeUInt32BE(term.length,0);
  stdout.write(len);
  stdout.write(term,callback);
}

function log(mes){
  if (typeof(mes) != 'string') mes = JSON.stringify(mes); 
  process.stderr.write((new Date()).toString().substring(4,24) + " " + mes + "\n");
}

function server(handler,init){
  var state,state_lock = false;
  port.on('readable', function next_term(){
    if(!state_lock && null !== (term = port.read())){
      state_lock = true;
      if(state === undefined) {
        state = (init) ? init(term) : term; // first term is initial state
        state_lock = false;
        next_term();
      }
      else{
        handler(term,function(term){port.write(term);},state,function(type,arg1,arg2){
          if (type === "reply") port.write(arg1);
          if ((type === "reply" && arg2 !== undefined) || (type === "noreply" && arg1 !== undefined)) {
            state = (arg2 === undefined) ? arg1 : arg2;
          }
          state_lock = false;
          next_term();
        });
      }
    }
  });
}
module.exports.port = port;
module.exports.server = server;
module.exports.log = log;
