# vod-fp-utility

```


const readFile = filename => {
  if(!filename){
    return Fail.of(CustomeError)
  }
  return Task.of((resolve,reject)=>{
    // async read file;
    // reject error
    // or resolve text string
  })
}

const httpPost  = str =>{
  return Task.of((resolve,reject)=>{
    // reject error
    // or resolve response JSON data
  })
}


const upload = compose(
  map(chain(httpPost)),
  readFile
)

readFile.map(chain(httpPost))

upload.map(()=>{
  // all right
})
.error(()=>{
  //handle error: invalid filname or read file error or httpPost error
  // we can handle error there no matter where it's occur
})

```
