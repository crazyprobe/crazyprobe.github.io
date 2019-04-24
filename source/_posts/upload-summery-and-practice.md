---
title: 上传漏洞总结与练习
date: 2019-04-23 20:43:08
tags: [web,漏洞]
---

## 常见检测方法及绕过

- 客户端javascript绕过 — 抓包改包

- 服务端绕过

  - MIME类型 — 修改content-type
  - 文件扩展名 — 黑名单绕过(php、php3、php4、php5、phtml、pht等)，windows大小写，特殊文件名构造windows(`shell.asp.`或`shell.asp空格`)，`::$DATA`，php在window的时候如果文件名+`::$DATA`会把`::$DATA`之后的数据当成文件流处理,不会检测后缀名.且保持`::$DATA`之前的文件名
  - 文件内容检测 — 图片头(GIF89a)，如检测`eval`等函数则进行函数变换
  - 文件加载检测 — 图片渲染：注释区插入代码、攻击文件加载器

- 其它— 0x00截断、.htaccess、.user.ini（使用fastcgi时）等

  - 00截断(过气)  php版本小于5.3.4，magic_quotes_gpc为OFF

  - 使用Apache中间件时，可利用.htaccess(默认开启)，如下配置文件名包含`test`则作为php解析

    ```
    <FilesMatch "test">
    SetHandler application/x-httpd-php
    </FilesMatch>
    ```

- 配合服务器解析漏洞

- 配合文件包含漏洞

<!-- more -->

## upload-labs练习

### 第一关

前端进行了后缀名校验，burpsuite抓包进行修改即可

### 第二关

服务端对数据包的MIME进行检查，上传一个jpg格式的文件，抓包修改文件名及文件内容即可

### 第三关

服务器端拦截了`.php`后缀名，但是用的是黑名单，可使用`php3`、`phtml`绕过

### 第四关

服务器过滤了常用的脚本后缀名，于是上传`.htaccess`内容为

```ini
<FilesMatch "test">
SetHandler application/x-httpd-php
</FilesMatch>
```

再上传名为`yjh.test`的一句话php即可

### 第五关

练习所使用系统为windows系统，未严格控制上传文件后缀，所以使用`Php`后缀可进行绕过

### 第六关

练习所使用系统为windows系统，可构造windows下的特殊文件名，后缀名使用`php空格`可进行绕过

### 第七关

练习所使用系统为windows系统，可构造windows下的特殊文件名，后缀名使用`php.`可进行绕过

### 第八关

练习所使用系统为windows系统，可构造windows下的特殊文件名，后缀名使用`php::$DATA`可进行绕过

### 第九关

```php
$is_upload = false;
$msg = null;
if (isset($_POST['submit'])) {
    if (file_exists(UPLOAD_PATH)) {
        $deny_ext = array(".php",".php5",".php4",".php3",".php2",".html",".htm",".phtml",".pht",".pHp",".pHp5",".pHp4",".pHp3",".pHp2",".Html",".Htm",".pHtml",".jsp",".jspa",".jspx",".jsw",".jsv",".jspf",".jtml",".jSp",".jSpx",".jSpa",".jSw",".jSv",".jSpf",".jHtml",".asp",".aspx",".asa",".asax",".ascx",".ashx",".asmx",".cer",".aSp",".aSpx",".aSa",".aSax",".aScx",".aShx",".aSmx",".cEr",".sWf",".swf",".htaccess");
        $file_name = trim($_FILES['upload_file']['name']);
        $file_name = deldot($file_name);//删除文件名末尾的点
        $file_ext = strrchr($file_name, '.');
        $file_ext = strtolower($file_ext); //转换为小写
        $file_ext = str_ireplace('::$DATA', '', $file_ext);//去除字符串::$DATA
        $file_ext = trim($file_ext); //首尾去空
        
        if (!in_array($file_ext, $deny_ext)) {
            $temp_file = $_FILES['upload_file']['tmp_name'];
            $img_path = UPLOAD_PATH.'/'.$file_name;
            if (move_uploaded_file($temp_file, $img_path)) {
                $is_upload = true;
            } else {
                $msg = '上传出错！';
            }
        } else {
            $msg = '此文件类型不允许上传！';
        }
    } else {
        $msg = UPLOAD_PATH . '文件夹不存在,请手工创建！';
    }
}
```

查看源码可知，进行后缀名判断后，直接拼接了`$file_name`，所以构造符合条件的后缀名即可，如`1.php . .`，

同时因为windows文件不能以点或者空格结尾，所以访问1.php即可

### 第十关

题目会从文件名中移除`php字符`，所以上传设置文件名为`10.pphphp`即可，移除第一个php后，文件名为`10.php`

### 第十一关

上传url地址为`/Pass-11/index.php?save_path=..`，所以上传路径可控，同时环境使用的是php5.2.17，所以存在00截断问题，所以构造上传url为`/Pass-11/index.php?save_path=../upload/11.php%00`可进行突破

### 第十二关

与第十一关考察的内容相同，但是这次路径是通过post方式提交的，所以需要将请求体中的`%00`解码成16进制的00字节

### 第十三关

通过文件的前两个字节来判断文件内容合法性，所以使用16进制编辑器打开图片，把一句话加到末尾即可

### 第十四关

通过`getimagesize`进行校验，使用上一关的方法同样可以绕过

### 第十五关

使用`exif_imagetype()`校验图片，同样使用图片马可以进行绕过

### 第十六关

会对上传的图片进行重新渲染，将一句话写入到注释区域或者不会被修改的部分即可。可参考[链接](https://xz.aliyun.com/t/2657)

### 第十七关

提示需要代码审计，查看代码如下：

```php
$is_upload = false;
$msg = null;

if(isset($_POST['submit'])){
    $ext_arr = array('jpg','png','gif');
    $file_name = $_FILES['upload_file']['name'];
    $temp_file = $_FILES['upload_file']['tmp_name'];
    $file_ext = substr($file_name,strrpos($file_name,".")+1);
    $upload_file = UPLOAD_PATH . '/' . $file_name;

    if(move_uploaded_file($temp_file, $upload_file)){
        if(in_array($file_ext,$ext_arr)){
             $img_path = UPLOAD_PATH . '/'. rand(10, 99).date("YmdHis").".".$file_ext;
             rename($upload_file, $img_path);
             $is_upload = true;
        }else{
            $msg = "只允许上传.jpg|.png|.gif类型文件！";
            unlink($upload_file);
        }
    }else{
        $msg = '上传出错！';
    }
}
```

先上传文件再进行重命名或删除操作，所以文件被重命名或删除之前的一瞬间是可以访问的。使用burp不断地进行上传操作，则可以在浏览器中访问到上传的页面

### 第十八关

提示需要代码审计，代码如下：

```php
//index.php
$is_upload = false;
$msg = null;
if (isset($_POST['submit']))
{
    require_once("./myupload.php");
    $imgFileName =time();
    $u = new MyUpload($_FILES['upload_file']['name'], $_FILES['upload_file']['tmp_name'], $_FILES['upload_file']['size'],$imgFileName);
    $status_code = $u->upload(UPLOAD_PATH);
    switch ($status_code) {
        case 1:
            $is_upload = true;
            $img_path = $u->cls_upload_dir . $u->cls_file_rename_to;
            break;
        case 2:
            $msg = '文件已经被上传，但没有重命名。';
            break; 
        case -1:
            $msg = '这个文件不能上传到服务器的临时文件存储目录。';
            break; 
        case -2:
            $msg = '上传失败，上传目录不可写。';
            break; 
        case -3:
            $msg = '上传失败，无法上传该类型文件。';
            break; 
        case -4:
            $msg = '上传失败，上传的文件过大。';
            break; 
        case -5:
            $msg = '上传失败，服务器已经存在相同名称文件。';
            break; 
        case -6:
            $msg = '文件无法上传，文件不能复制到目标目录。';
            break;      
        default:
            $msg = '未知错误！';
            break;
    }
}

//myupload.php
class MyUpload{
......
......
...... 
  var $cls_arr_ext_accepted = array(
      ".doc", ".xls", ".txt", ".pdf", ".gif", ".jpg", ".zip", ".rar", ".7z",".ppt",
      ".html", ".xml", ".tiff", ".jpeg", ".png" );

......
......
......  
  /** upload()
   **
   ** Method to upload the file.
   ** This is the only method to call outside the class.
   ** @para String name of directory we upload to
   ** @returns void
  **/
  function upload( $dir ){
    
    $ret = $this->isUploadedFile();
    
    if( $ret != 1 ){
      return $this->resultUpload( $ret );
    }

    $ret = $this->setDir( $dir );
    if( $ret != 1 ){
      return $this->resultUpload( $ret );
    }

    $ret = $this->checkExtension();
    if( $ret != 1 ){
      return $this->resultUpload( $ret );
    }

    $ret = $this->checkSize();
    if( $ret != 1 ){
      return $this->resultUpload( $ret );    
    }
    
    // if flag to check if the file exists is set to 1
    
    if( $this->cls_file_exists == 1 ){
      
      $ret = $this->checkFileExists();
      if( $ret != 1 ){
        return $this->resultUpload( $ret );    
      }
    }

    // if we are here, we are ready to move the file to destination

    $ret = $this->move();
    if( $ret != 1 ){
      return $this->resultUpload( $ret );    
    }

    // check if we need to rename the file

    if( $this->cls_rename_file == 1 ){
      $ret = $this->renameFile();
      if( $ret != 1 ){
        return $this->resultUpload( $ret );    
      }
    }
    
    // if we are here, everything worked as planned :)

    return $this->resultUpload( "SUCCESS" );
  
  }
......
......
...... 
};
```

可以看到这里也是先上传文件再进行重命名，但对后缀名进行了白名单过滤，所以竞争配合Apache解析漏洞可getshell，

参考此[链接](https://uuzdaisuki.com/2018/05/01/%E8%A7%A3%E6%9E%90%E6%BC%8F%E6%B4%9E%E6%80%BB%E7%BB%93/)

> apache版本在以下范围内
>
> - Apache 2.0.x <= 2.0.59
> - Apache 2.2.x <= 2.2.17
> - Apache 2.2.2 <= 2.2.8
>
> 都可以通过上传xxx.php.rar或xxx.php+任意无法解析后缀解析为php

### 第十九关

这一关必须使用linux环境，所以使用github上提供的docker环境

利用`CVE-2017-15715`解析漏洞可绕过成功，参考p牛[文章](https://www.leavesongs.com/PENETRATION/apache-cve-2017-15715-vulnerability.html)

Apache版本在2.4.0到2.4.29即可

### 第二十关

Pass-20来源于CTF，需要查看源代码，源码如下：

```php
$is_upload = false;
$msg = null;
if(!empty($_FILES['upload_file'])){
    //检查MIME
    $allow_type = array('image/jpeg','image/png','image/gif');
    if(!in_array($_FILES['upload_file']['type'],$allow_type)){
        $msg = "禁止上传该类型文件!";
    }else{
        //检查文件名
        $file = empty($_POST['save_name']) ? $_FILES['upload_file']['name'] : $_POST['save_name'];
        if (!is_array($file)) {
            $file = explode('.', strtolower($file));
        }

        $ext = end($file);
        $allow_suffix = array('jpg','png','gif');
        if (!in_array($ext, $allow_suffix)) {
            $msg = "禁止上传该后缀文件!";
        }else{
            $file_name = reset($file) . '.' . $file[count($file) - 1];
            $temp_file = $_FILES['upload_file']['tmp_name'];
            $img_path = UPLOAD_PATH . '/' .$file_name;
            if (move_uploaded_file($temp_file, $img_path)) {
                $msg = "文件上传成功！";
                $is_upload = true;
            } else {
                $msg = "文件上传失败！";
            }
        }
    }
}else{
    $msg = "请选择要上传的文件！";
}
```

这里只需要上传时将save_name参数构造为数组则可绕过explode方法，然后进行拼接。所以将save_name构造为数组，然后在第一个参数中添加`0x00`，则最终拼接的文件名中会包含`0x00`，成功上传

![image-20190424175726385](./image-20190424175726385.png)