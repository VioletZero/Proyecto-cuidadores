package org.asyncstorage.legacy_storage

import androidx.room.EntityInsertAdapter
import androidx.room.RoomDatabase
import androidx.room.util.appendPlaceholders
import androidx.room.util.getColumnIndexOrThrow
import androidx.room.util.performInTransactionSuspending
import androidx.room.util.performSuspending
import androidx.sqlite.SQLiteStatement
import javax.`annotation`.processing.Generated
import kotlin.Int
import kotlin.String
import kotlin.Suppress
import kotlin.Unit
import kotlin.collections.List
import kotlin.collections.MutableList
import kotlin.collections.mutableListOf
import kotlin.reflect.KClass
import kotlin.text.StringBuilder

@Generated(value = ["androidx.room.RoomProcessor"])
@Suppress(names = ["UNCHECKED_CAST", "DEPRECATION", "REDUNDANT_PROJECTION", "REMOVAL"])
internal class StorageDao_Impl(
  __db: RoomDatabase,
) : StorageDao {
  private val __db: RoomDatabase

  private val __insertAdapterOfEntry: EntityInsertAdapter<Entry>
  init {
    this.__db = __db
    this.__insertAdapterOfEntry = object : EntityInsertAdapter<Entry>() {
      protected override fun createQuery(): String =
          "INSERT OR REPLACE INTO `Storage` (`key`,`value`) VALUES (?,?)"

      protected override fun bind(statement: SQLiteStatement, entity: Entry) {
        statement.bindText(1, entity.key)
        val _tmpValue: String? = entity.value
        if (_tmpValue == null) {
          statement.bindNull(2)
        } else {
          statement.bindText(2, _tmpValue)
        }
      }
    }
  }

  public override suspend fun setValues(entries: List<Entry>): Unit = performSuspending(__db, false,
      true) { _connection ->
    __insertAdapterOfEntry.insert(_connection, entries)
  }

  public override suspend fun mergeValues(entries: List<Entry>): Unit =
      performInTransactionSuspending(__db) {
    super@StorageDao_Impl.mergeValues(entries)
  }

  public override suspend fun getValues(keys: List<String>): List<Entry> {
    val _stringBuilder: StringBuilder = StringBuilder()
    _stringBuilder.append("SELECT * FROM Storage WHERE `key` IN (")
    val _inputSize: Int = keys.size
    appendPlaceholders(_stringBuilder, _inputSize)
    _stringBuilder.append(")")
    val _sql: String = _stringBuilder.toString()
    return performSuspending(__db, true, true) { _connection ->
      val _stmt: SQLiteStatement = _connection.prepare(_sql)
      try {
        var _argIndex: Int = 1
        for (_item: String in keys) {
          _stmt.bindText(_argIndex, _item)
          _argIndex++
        }
        val _columnIndexOfKey: Int = getColumnIndexOrThrow(_stmt, "key")
        val _columnIndexOfValue: Int = getColumnIndexOrThrow(_stmt, "value")
        val _result: MutableList<Entry> = mutableListOf()
        while (_stmt.step()) {
          val _item_1: Entry
          val _tmpKey: String
          _tmpKey = _stmt.getText(_columnIndexOfKey)
          val _tmpValue: String?
          if (_stmt.isNull(_columnIndexOfValue)) {
            _tmpValue = null
          } else {
            _tmpValue = _stmt.getText(_columnIndexOfValue)
          }
          _item_1 = Entry(_tmpKey,_tmpValue)
          _result.add(_item_1)
        }
        _result
      } finally {
        _stmt.close()
      }
    }
  }

  public override suspend fun getKeys(): List<String> {
    val _sql: String = "SELECT `key` FROM Storage"
    return performSuspending(__db, true, true) { _connection ->
      val _stmt: SQLiteStatement = _connection.prepare(_sql)
      try {
        val _result: MutableList<String> = mutableListOf()
        while (_stmt.step()) {
          val _item: String
          _item = _stmt.getText(0)
          _result.add(_item)
        }
        _result
      } finally {
        _stmt.close()
      }
    }
  }

  public override suspend fun removeValues(keys: List<String>) {
    val _stringBuilder: StringBuilder = StringBuilder()
    _stringBuilder.append("DELETE FROM Storage WHERE `key` in (")
    val _inputSize: Int = keys.size
    appendPlaceholders(_stringBuilder, _inputSize)
    _stringBuilder.append(")")
    val _sql: String = _stringBuilder.toString()
    return performSuspending(__db, false, true) { _connection ->
      val _stmt: SQLiteStatement = _connection.prepare(_sql)
      try {
        var _argIndex: Int = 1
        for (_item: String in keys) {
          _stmt.bindText(_argIndex, _item)
          _argIndex++
        }
        _stmt.step()
      } finally {
        _stmt.close()
      }
    }
  }

  public override suspend fun clear() {
    val _sql: String = "DELETE FROM Storage"
    return performSuspending(__db, false, true) { _connection ->
      val _stmt: SQLiteStatement = _connection.prepare(_sql)
      try {
        _stmt.step()
      } finally {
        _stmt.close()
      }
    }
  }

  public companion object {
    public fun getRequiredConverters(): List<KClass<*>> = emptyList()
  }
}
